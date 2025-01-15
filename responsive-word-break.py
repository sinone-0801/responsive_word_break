import sys
import os
from bs4 import BeautifulSoup, Doctype, Declaration, Comment, NavigableString
import MeCab
from collections import defaultdict

def parse_html_and_wrap_morphemes(html_content):
    # BeautifulSoupオブジェクトの作成
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 既存のresponsive_word_breakスタイルがあるかチェック
    existing_style = soup.find('style', class_='responsive_word_break')
    if existing_style:
        return str(soup)  # 既存のスタイルがある場合は変更せずに返す

    # 常に新しいスタイルタグを追加する
    style = """
    /* テキストブロックのスタイル */
    .text-block {
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
        line-height: 1.6;
        margin-bottom: 1em;
    }

    /* レスポンシブな段落 */
    .responsive-paragraph {
        display: block;
        width: 100%;
    }

    /* 改行制御クラス */
    .break-word {
        word-break: break-all;
    }

    /* 任意の改行ポイント */
    .word-wrapper {
        display: inline-block;
    }

    /* スマートフォン向け */
    @media (max-width: 767px) {
        .text-block {
            font-size: 16px;
        }
    }

    /* タブレット向け */
    @media (min-width: 768px) and (max-width: 1023px) {
        .text-block {
            font-size: 18px;
        }
    }

    /* デスクトップ向け */
    @media (min-width: 1024px) {
        .text-block {
            font-size: 20px;
        }
    }
    """
    
    # headタグを探すか作成
    head = soup.find('head') or soup.new_tag('head')
    if not soup.head:
        soup.html.insert(0, head)
    
    # 新しいstyleタグを作成（クラス付き）
    style_tag = soup.new_tag('style')
    style_tag['class'] = 'responsive_word_break'
    style_tag.string = style
    head.append(style_tag)
    
    # MeCabの初期化
    mecab = MeCab.Tagger()
    
    def should_process_node(element):
        if not isinstance(element, NavigableString):
            return False
        
        # 親タグをチェック
        parent = element.parent
        
        # 特定のタグ内のテキストは処理しない
        if not parent or parent.name in {'script', 'style', 'code', 'pre', 'title', 'keyword'}:
            return False
            
        # 属性値は処理しない
        if parent and any(element == value for attr, value in parent.attrs.items()):
            return False
            
        # コメント、DOCTYPE、その他の特殊ノードは処理しない
        if isinstance(element, (Doctype, Declaration, Comment)):
            return False
            
        # 空白のみのテキストは処理しない
        if not element.strip():
            return False
            
        return True

    def process_text(text):
        node = mecab.parseToNode(text)
        result = ''
        current_chunk = ''
        
        while node:
            if node.surface:
                pos = node.feature.split(',')[0]  # 品詞情報の取得
                
                # 以下の品詞は前の内容語にくっつける
                if pos in {'助詞', '助動詞', '記号', '補助記号', '句読点'}:
                    current_chunk += node.surface
                else:
                    # 内容語の場合
                    if current_chunk:
                        # 前の内容語＋付属語があれば出力
                        result += f'<span class="word-wrapper">{current_chunk}</span>'
                        current_chunk = ''
                    current_chunk = node.surface
            
            node = node.next
        
        # 最後の chunk を処理
        if current_chunk:
            result += f'<span class="word-wrapper">{current_chunk}</span>'
        
        return BeautifulSoup(result, 'html.parser')

    # テキストノードを処理
    for element in soup.find_all(string=True):
        if should_process_node(element):
            element.replace_with(process_text(element.string))
    
    return str(soup)

def main():
    # コマンドライン引数のチェック
    if len(sys.argv) != 2:
        print("使用方法: python script.py <input_html_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    # 入力ファイルの存在確認
    if not os.path.exists(input_file):
        print(f"エラー: ファイル '{input_file}' が見つかりません。")
        sys.exit(1)
    
    # outディレクトリがなければ作成
    if not os.path.exists('out'):
        os.makedirs('out')
    
    # 入力ファイルを読み込み
    with open(input_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # HTMLの処理
    modified_html = parse_html_and_wrap_morphemes(html_content)
    
    # 出力ファイル名の生成
    output_file = os.path.join('out', os.path.basename(input_file))
    
    # 結果を保存
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(modified_html)
    
    print(f"処理が完了しました。結果は '{output_file}' に保存されました。")

if __name__ == "__main__":
    main()