<style>
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
                white-space: pre-wrap;
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
            /* プログレスバーのスタイル追加 */
            .rwb-progress {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 3px;
                background: #f0f0f0;
                z-index: 1000;
            }
            .rwb-progress-bar {
                height: 100%;
                background: #4CAF50;
                transition: width 0.3s ease;
            }
</style>

<?php
// functions.php または現在のテーマの適切なPHPファイルに追加
function add_text_tokenizer() {
    ?>
    <script>
        // 日本語トークナイザーの実装
        class JapaneseTokenizer {
            constructor() {
                this.patterns = [
                    /[一-龠]+|[ぁ-ん]+|[ァ-ヴー]+|[a-zA-Z0-9]+|[ａ-ｚＡ-Ｚ０-９]+/g,
                    /[、。！？］［）（｝｛」「：；／…◯]+/g
                ];
            }

            tokenize(text) {
                console.log('Tokenizing:', text); // デバッグログ
                let tokens = [];
                let lastIndex = 0;

                this.patterns.forEach(pattern => {
                    let match;
                    pattern.lastIndex = 0;

                    while ((match = pattern.exec(text)) !== null) {
                        const start = match.index;
                        const end = pattern.lastIndex;

                        if (start > lastIndex) {
                            const preceding = text.slice(lastIndex, start).trim();
                            if (preceding) {
                                tokens.push(preceding);
                            }
                        }

                        tokens.push(match[0]);
                        lastIndex = end;
                    }
                });

                if (lastIndex < text.length) {
                    const remaining = text.slice(lastIndex).trim();
                    if (remaining) {
                        tokens.push(remaining);
                    }
                }

                return tokens.filter(token => token.trim());
            }
        }

        function wrapTextWithTokens() {
            console.log('Script started'); // デバッグログ
            
            const tokenizer = new JapaneseTokenizer();
            // main-contentクラスがない場合は、bodyを対象にする
            const mainContent = document.querySelector('.main-content') || document.body;
            
            // 対象要素の選択を調整
            const targetElements = mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, span');
            console.log('Found elements:', targetElements.length); // デバッグログ

            function processElement(element) {
                // すでに処理済みの要素はスキップ
                if (element.getAttribute('data-tokenized')) return;
                
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    { acceptNode: node => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
                );

                const textNodes = [];
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }

                textNodes.forEach(textNode => {
                    const text = textNode.textContent.trim();
                    if (!text) return;

                    console.log('Processing text:', text); // デバッグログ
                    const tokens = tokenizer.tokenize(text);
                    const fragment = document.createDocumentFragment();

                    tokens.forEach(token => {
                        const span = document.createElement('span');
                        span.className = 'word-wrapper';
                        span.textContent = token;
                        fragment.appendChild(span);
                    });

                    textNode.parentNode.replaceChild(fragment, textNode);
                });

                element.setAttribute('data-tokenized', 'true');
            }

            // 要素を一つずつ処理
            targetElements.forEach((element, index) => {
                setTimeout(() => {
                    processElement(element);
                }, index * 10); // 10msごとに処理
            });
        }

        // DOMContentLoadedとloadの両方で実行を試みる
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOMContentLoaded fired'); // デバッグログ
            setTimeout(wrapTextWithTokens, 500);
        });

        window.addEventListener('load', function() {
            console.log('Window load fired'); // デバッグログ
            setTimeout(wrapTextWithTokens, 1000);
        });

    </script>
    <?php
}
add_action('wp_footer', 'add_text_tokenizer', 99);

?>