import MeCab
import re
from typing import List, Set, Tuple
from bs4 import BeautifulSoup
import html
import argparse
from pathlib import Path

class ResponsiveWordBreak:
    def __init__(self):
        # MeCabの初期化
        self.tagger = MeCab.Tagger()
        
        # 助詞などの付属語タイプの設定
        self.particle_types: Set[str] = {
            '助詞', '助動詞', '記号', '補助記号', '句点', '読点'
        }
        
        # 処理から除外するHTMLタグ
        self.exclude_tags: Set[str] = {
            'script', 'style', 'code', 'pre', 'title', 'keyword',
            'html', 'head'
        }
        
        # CSSスタイル定義
        self.style = """
            .text-block {
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                line-height: 1.6;
                margin-bottom: 1em;
            }
            .responsive-paragraph {
                display: block;
                width: 100%;
            }
            .break-word {
                word-break: break-all;
            }
            .word-wrapper {
                display: inline-block;
            }
            @media (max-width: 767px) {
                .text-block { font-size: 16px; }
            }
            @media (min-width: 768px) and (max-width: 1023px) {
                .text-block { font-size: 18px; }
            }
            @media (min-width: 1024px) {
                .text-block { font-size: 20px; }
            }
        """

    def should_process_node(self, node) -> bool:
        """ノードを処理すべきかどうかを判定"""
        if node.string is None:
            return False

        # 除外タグ内のテキストは処理しない
        if node.parent.name in self.exclude_tags:
            return False
            
        # HTMLタグとして解釈されるテキストは処理しない
        if re.search(r'<[^>]+>', node.string):
            return False
            
        # 属性値は処理しない
        if node.parent.attrs:
            for attr_value in node.parent.attrs.values():
                if isinstance(attr_value, str) and attr_value == node.string:
                    return False
                elif isinstance(attr_value, list) and node.string in attr_value:
                    return False

        return True

    def split_latin_sequence(self, sequence: str) -> List[str]:
        """英数字シーケンスを単語単位に分割"""
        words = re.findall(r'\S+|\s+', sequence)
        result = []
        
        i = 0
        while i < len(words):
            word = words[i]
            if word.strip():
                # スペースが後続する場合は含める
                if i + 1 < len(words) and not words[i + 1].strip():
                    result.append(word + words[i + 1])
                    i += 2
                else:
                    result.append(word)
                    i += 1
            else:
                # スペースだけの場合はそのまま追加
                result.append(word)
                i += 1
            
        return result

    def process_japanese_text(self, text: str) -> str:
        """日本語テキストを処理"""
        print(f"Debug: Processing as Japanese text: '{text}'")
        node = self.tagger.parseToNode(text)
        result = []
        current_chunk = ''
        latin_sequence = ''
        has_latin_sequence = False

        while node:
            if node.surface:  # 空ノードをスキップ
                surface = html.escape(node.surface)
                features = node.feature.split(',')
                pos = features[0]

                # アルファベットや数字の連続をチェック
                is_latin_or_num = bool(re.match(r'^[a-zA-Z0-9.,\-_!@#$%^&*()+~?=]+$', surface))
                is_space = bool(re.match(r'^\s+$', surface))

                if is_latin_or_num:
                    print(f"Debug: Latin/Num found: '{surface}'")
                    if current_chunk:
                        result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{current_chunk}</span>')
                        current_chunk = ''
                    latin_sequence += surface
                    has_latin_sequence = True

                elif is_space:
                    print(f"Debug: Space found: '{surface}'")
                    if has_latin_sequence:
                        # ラテン文字シーケンスにスペースを追加
                        latin_sequence += surface
                    elif current_chunk:
                        # 日本語チャンクにスペースを追加
                        result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{current_chunk}{surface}</span>')
                        current_chunk = ''
                    else:
                        # 単独のスペース
                        result.append(surface)

                else:
                    if has_latin_sequence:
                        # ラテン文字シーケンスを分割して追加
                        words = self.split_latin_sequence(latin_sequence)
                        for word in words:
                            if word.strip():
                                result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{word}</span>')
                            else:
                                result.append(word)
                        latin_sequence = ''
                        has_latin_sequence = False

                    if pos in self.particle_types:
                        if current_chunk:
                            current_chunk += surface
                        else:
                            current_chunk = surface
                    else:
                        if current_chunk:
                            result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{current_chunk}</span>')
                        current_chunk = surface

            node = node.next

        # 最後の処理
        if has_latin_sequence:
            words = self.split_latin_sequence(latin_sequence)
            for word in words:
                if word.strip():
                    result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{word}</span>')
                else:
                    result.append(word)
        if current_chunk:
            result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{current_chunk}</span>')

        final_result = ''.join(result)
        print(f"Debug: Japanese text result: '{final_result}'")
        return final_result

    def process_latin_text(self, text: str) -> str:
        """アルファベット・数字のテキストを処理"""
        print(f"Debug: Processing as Latin text: '{text}'")
        words = self.split_latin_sequence(text)
        result = []
        
        for word in words:
            if word.strip():
                result.append(f'<span class="word-wrapper" style="white-space: pre-wrap;">{word}</span>')
            else:
                result.append(word)

        final_result = ''.join(result)
        print(f"Debug: Latin text result: '{final_result}'")
        return final_result

    def is_mostly_japanese(self, text: str) -> bool:
        """テキストが主に日本語かどうかを判定"""
        # 日本語文字（ひらがな、カタカナ、漢字）を検出
        japanese_chars = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]', text))
        # 英数字を検出
        ascii_chars = len(re.findall(r'[a-zA-Z0-9]', text))
        
        return japanese_chars > ascii_chars

    def process_text(self, text: str) -> str:
        """テキストを処理して単語分割を行う"""
        print("\n=== Debug: process_text start ===")
        print(f"Input text: '{text}'")

        # テキストの種類を判定して適切な処理を選択
        if self.is_mostly_japanese(text):
            print("Debug: Detected as Japanese text")
            result = self.process_japanese_text(text)
        else:
            print("Debug: Detected as Latin text")
            result = self.process_latin_text(text)

        print("=== Debug: process_text end ===\n")
        return result

    def process_html(self, html_content: str) -> str:
        """HTMLコンテンツを処理"""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # スタイルの追加
        if not soup.find('style', {'class': 'responsive_word_break'}):
            style_tag = soup.new_tag('style')
            style_tag['class'] = 'responsive_word_break'
            style_tag.string = self.style
            soup.head.append(style_tag)
        
        # テキストノードの処理
        for text_node in soup.find_all(string=True):
            if self.should_process_node(text_node):
                processed_text = self.process_text(text_node.string)
                if processed_text != text_node.string:
                    new_tag = soup.new_tag('span')
                    new_tag['data-rwb-processed'] = 'true'
                    new_tag.append(BeautifulSoup(processed_text, 'html.parser'))
                    text_node.replace_with(new_tag)
        
        return str(soup)

def main():
    # コマンドライン引数の設定
    parser = argparse.ArgumentParser(description='HTMLファイルの単語分割処理を行います')
    parser.add_argument('input_file', help='処理するHTMLファイル')
    args = parser.parse_args()

    # 入力ファイルパスの検証
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: ファイルが見つかりません: {input_path}")
        return
    
    # 出力ディレクトリの作成
    out_dir = Path('out')
    out_dir.mkdir(exist_ok=True)
    
    # 出力ファイルパスの設定
    output_path = out_dir / input_path.name

    # HTMLファイルの処理
    rwb = ResponsiveWordBreak()
    
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        processed_html = rwb.process_html(html_content)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(processed_html)
            
        print(f"処理が完了しました。出力ファイル: {output_path}")
        
    except Exception as e:
        print(f"Error: ファイルの処理中にエラーが発生しました: {e}")

if __name__ == "__main__":
    main()