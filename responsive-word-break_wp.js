// responsive-word-break.js
(function($) {
    class ResponsiveWordBreak {
        constructor() {
            this.tokenizer = null;
            this.PROCESSED_MARKER = 'data-rwb-processed';
            this.particleTypes = new Set(['助詞', '助動詞', '記号', '補助記号', '句点', '読点']);
            this.isProcessing = false;
            
            // 処理対象を限定
            this.targetSelectors = '.entry-content, .post-content, article'; // WordPressの主要コンテンツ領域
            
            // チャンクサイズを調整
            this.CHUNK_SIZE = 5;
            this.CHUNK_DELAY = 50; // 処理間隔を増やす
            this.MAX_TEXT_LENGTH = 1000; // 一度に処理する最大文字数
            this.PROCESS_TIMEOUT = 30000; // 処理の最大時間（30秒）
            
            this.processStartTime = null;
            this.processTimer = null;
        }

        init() {
            if (!$('style.responsive_word_break').length) {
                this.addStyle();
            }

            // 処理開始前にローディング表示
            this.showLoading();

            kuromoji.builder({ 
                dicPath: rwbParams.dicPath 
            }).build((err, tokenizer) => {
                if (err) {
                    console.error('Tokenizer initialization failed:', err);
                    this.hideLoading();
                    return;
                }
                this.tokenizer = tokenizer;
                this.processTargetContent();
            });
        }

        showLoading() {
            $('body').append('<div class="rwb-loading">テキスト処理中...<div class="rwb-progress"><div class="rwb-progress-bar"></div></div></div>');
        }

        hideLoading() {
            $('.rwb-loading').remove();
        }

        updateProgress(percent) {
            $('.rwb-progress-bar').css('width', percent + '%');
        }

        processTargetContent() {
            this.processStartTime = Date.now();
            const targetElements = $(this.targetSelectors).not('[' + this.PROCESSED_MARKER + '="true"]');
            
            if (targetElements.length === 0) {
                this.hideLoading();
                return;
            }

            this.processElementsInChunks(targetElements);
        }

        processElementsInChunks(elements) {
            let currentIndex = 0;
            const totalElements = elements.length;

            const processChunk = () => {
                // 処理時間チェック
                if (Date.now() - this.processStartTime > this.PROCESS_TIMEOUT) {
                    console.warn('Processing timeout reached');
                    this.hideLoading();
                    return;
                }

                const chunk = elements.slice(currentIndex, currentIndex + this.CHUNK_SIZE);
                
                chunk.each((_, element) => {
                    this.processElement($(element));
                });

                currentIndex += this.CHUNK_SIZE;
                this.updateProgress((currentIndex / totalElements) * 100);

                if (currentIndex < totalElements) {
                    setTimeout(processChunk, this.CHUNK_DELAY);
                } else {
                    this.hideLoading();
                }
            };

            processChunk();
        }

        processElement($element) {
            if ($element.attr(this.PROCESSED_MARKER) === 'true') {
                return;
            }

            const text = $element.text();
            if (!text || text.length > this.MAX_TEXT_LENGTH) {
                $element.attr(this.PROCESSED_MARKER, 'true');
                return;
            }

            const processedText = this.processText(text);
            $element.html(processedText).attr(this.PROCESSED_MARKER, 'true');
        }

        processText(text) {
            if (!text.trim()) return text;

            // 短いテキストや英数字のみの場合はそのまま返す
            if (text.length < 10 || /^[a-zA-Z0-9\s.,\-_!@#$%^&*()+=]+$/.test(text)) {
                return text;
            }

            const tokens = this.tokenizer.tokenize(text);
            let result = '';
            let currentChunk = '';

            tokens.forEach((token, index) => {
                const surface = token.surface_form;
                
                if (this.particleTypes.has(token.pos)) {
                    currentChunk += surface;
                } else {
                    if (currentChunk) {
                        result += `<span class="word-wrapper">${currentChunk}</span>`;
                        currentChunk = '';
                    }
                    result += `<span class="word-wrapper">${surface}</span>`;
                }

                if (index === tokens.length - 1 && currentChunk) {
                    result += `<span class="word-wrapper">${currentChunk}</span>`;
                }
            });

            return result;
        }

        addStyle() {
            const style = `
                .word-wrapper {
                    display: inline-block;
                    white-space: pre-wrap;
                }
                .rwb-loading {
                    position: fixed;
                    top: 32px;
                    left: 0;
                    width: 100%;
                    background: rgba(255, 255, 255, 0.9);
                    padding: 10px;
                    text-align: center;
                    z-index: 999999;
                }
                .rwb-progress {
                    height: 3px;
                    background: #f0f0f0;
                    margin-top: 5px;
                }
                .rwb-progress-bar {
                    height: 100%;
                    background: #0073aa;
                    transition: width 0.3s ease;
                    width: 0%;
                }
            `;
            $('<style>').addClass('responsive_word_break').text(style).appendTo('head');
        }
    }

    // 遅延初期化
    $(window).on('load', function() {
        setTimeout(function() {
            const rwb = new ResponsiveWordBreak();
            rwb.init();
        }, 1000); // ページ読み込み後1秒待ってから初期化
    });

})(jQuery);

// 使い方
// htmlと同じディレクトリに responsive-word-break.js を配置
/* 
<head>
    <!-- kuromoji.jsの読み込み -->
    <script src="https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js"></script>
    <!-- 作成したスクリプトの読み込み -->
    <script src="responsive-word-break.js"></script>
</head>
*/