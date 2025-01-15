class ResponsiveWordBreak {
    constructor() {
        // MeCabの代わりにkuromoji.jsを使用
        this.tokenizer = null;
        this.PROCESSED_MARKER = 'data-rwb-processed';
        this.particleTypes = new Set(['助詞', '助動詞', '記号', '補助記号', '句点', '読点']);
        this.isProcessing = false;

        // 除外タグに開発者ツール関連の要素を追加
        this.excludeTags = new Set([
            'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TITLE',
            'HTML', 'HEAD', // 開発者ツール関連
        ]);
        
        // チャンクサイズを調整
        this.CHUNK_SIZE = 10; // より小さな値に
        
        // 処理間隔を追加
        this.CHUNK_DELAY = 10; // ミリ秒

        // スタイルの定義
        this.style = `
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

        `;
    }

    init() {
        if (!document.querySelector('style.responsive_word_break')) {
            this.addStyle();
        }

        // プログレスバーの追加
        this.addProgressBar();

        kuromoji.builder({ 
            dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict' 
        }).build((err, tokenizer) => {
            if (err) {
                console.error('Tokenizer initialization failed:', err);
                return;
            }
            this.tokenizer = tokenizer;
            this.processDocumentInChunks();
            this.observeChanges();
        });
    }

    addProgressBar() {
        const progress = document.createElement('div');
        progress.className = 'rwb-progress';
        progress.innerHTML = '<div class="rwb-progress-bar" style="width: 0%"></div>';
        document.body.insertBefore(progress, document.body.firstChild);
    }

    updateProgress(percent) {
        const bar = document.querySelector('.rwb-progress-bar');
        if (bar) {
            bar.style.width = `${percent}%`;
            if (percent >= 100) {
                setTimeout(() => {
                    bar.parentElement.remove();
                }, 500);
            }
        }
    }

    async processDocumentInChunks() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const nodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return this.shouldProcessNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            nodes.push(node);
        }

        const totalNodes = nodes.length;
        let processedNodes = 0;

        for (let i = 0; i < nodes.length; i += this.CHUNK_SIZE) {
            const chunk = nodes.slice(i, i + this.CHUNK_SIZE);
            
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    chunk.forEach(node => {
                        if (!node.isConnected) return; // 既に削除された要素はスキップ
                        try {
                            this.processNode(node);
                        } catch (error) {
                            console.error('Error processing node:', error);
                        }
                    });
                    processedNodes += chunk.length;
                    this.updateProgress((processedNodes / totalNodes) * 100);
                    resolve();
                });
            });

            // チャンク間の遅延を増やす
            await new Promise(resolve => setTimeout(resolve, this.CHUNK_DELAY));
        }

        this.isProcessing = false;
    }

    addStyle() {
        const styleElement = document.createElement('style');
        styleElement.className = 'responsive_word_break';
        styleElement.textContent = this.style;
        document.head.appendChild(styleElement);
    }

    shouldProcessNode(node) {
        if (node.nodeType !== Node.TEXT_NODE) return false;
        if (!node.textContent.trim()) return false;
        
        const parent = node.parentElement;
        if (!parent) return false;
        
        // 除外タグまたは処理済みのノードはスキップ
        if (this.excludeTags.has(parent.tagName) || 
            parent.hasAttribute(this.PROCESSED_MARKER)) {
            return false;
        }
        
        // 属性値は処理しない
        const attributes = Array.from(parent.attributes);
        return !attributes.some(attr => attr.value === node.textContent);
    }

    // MutationObserverの改善
    observeChanges() {
        let timer = null;
        const observer = new MutationObserver(mutations => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                // 開発者ツールのDOM変更を無視
                if (mutations.some(m => this.isDevToolsRelated(m.target))) {
                    return;
                }

                const newNodes = [];
                mutations.forEach(mutation => {
                    // 属性の変更は無視
                    if (mutation.type === 'attributes') return;
                    
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute(this.PROCESSED_MARKER)) {
                            const walker = document.createTreeWalker(
                                node,
                                NodeFilter.SHOW_TEXT,
                                null,
                                false
                            );
                            let textNode;
                            while (textNode = walker.nextNode()) {
                                if (this.shouldProcessNode(textNode)) {
                                    newNodes.push(textNode);
                                }
                            }
                        }
                    });
                });

                if (newNodes.length > 0) {
                    this.processNodesAsync(newNodes);
                }
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });
    }

    // 開発者ツール関連のチェックを追加
    isDevToolsRelated(element) {
        if (!element) return false;
        // 開発者ツール関連の要素をチェック
        return element.id?.includes('__debug') || 
                element.className?.includes('debug') ||
                element.tagName === 'HTML' ||
                element.tagName === 'HEAD';
    }
    
    async processNodesAsync(nodes) {
        for (let i = 0; i < nodes.length; i += this.CHUNK_SIZE) {
            const chunk = nodes.slice(i, i + this.CHUNK_SIZE);
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    chunk.forEach(node => this.processNode(node));
                    resolve();
                });
            });
        }
    }

    processText(text) {
        // アルファベット・数字・記号の連続をチェック
        const isLatinOrNumeric = /^[a-zA-Z0-9\s.,\-_!@#$%^&*()+=]+$/.test(text.trim());
        
        if (isLatinOrNumeric) {
            // 空白で区切られた単語として処理（空白は前の単語に含める）
            const words = text.split(/(?<=\s)/);
            return words.map(word => {
                if (!word.trim()) return word; // 完全な空白文字列はそのまま返す
                return `<span class="word-wrapper">${word}</span>`;
            }).join('');
        }
    
        // 日本語テキストの処理
        const tokens = this.tokenizer.tokenize(text);
        let result = '';
        let currentChunk = '';
        let hasLatinSequence = false;
        let latinSequence = '';
        
        tokens.forEach((token, index) => {
            const isLatinOrNum = /^[a-zA-Z0-9.,\-_!@#$%^&*()+=]+$/.test(token.surface_form);
            const isSpace = /^\s+$/.test(token.surface_form);
    
            if (isLatinOrNum) {
                // アルファベットや数字の連続を蓄積
                if (currentChunk) {
                    result += `<span class="word-wrapper">${currentChunk}</span>`;
                    currentChunk = '';
                }
                latinSequence += token.surface_form;
                hasLatinSequence = true;
            } else if (isSpace) {
                // スペースの処理
                if (hasLatinSequence) {
                    latinSequence += token.surface_form;
                } else if (currentChunk) {
                    currentChunk += token.surface_form;
                } else {
                    result += token.surface_form;
                }
            } else {
                // 日本語文字などの処理
                if (hasLatinSequence) {
                    result += `<span class="word-wrapper">${latinSequence}</span>`;
                    latinSequence = '';
                    hasLatinSequence = false;
                }
                
                if (this.particleTypes.has(token.pos)) {
                    currentChunk += token.surface_form;
                } else {
                    if (currentChunk) {
                        result += `<span class="word-wrapper">${currentChunk}</span>`;
                        currentChunk = '';
                    }
                    currentChunk = token.surface_form;
                }
            }
            
            // 最後のトークンの処理
            if (index === tokens.length - 1) {
                if (hasLatinSequence) {
                    result += `<span class="word-wrapper">${latinSequence}</span>`;
                }
                if (currentChunk) {
                    result += `<span class="word-wrapper">${currentChunk}</span>`;
                }
            }
        });
        
        return result;
    }

    processNode(node) {
        if (!this.shouldProcessNode(node)) return;
        
        const processed = this.processText(node.textContent);
        const wrapper = document.createElement('span');
        wrapper.innerHTML = processed;
        
        // 処理済みマーカーを設定
        node.parentElement.setAttribute(this.PROCESSED_MARKER, 'true');
        node.parentElement.replaceChild(wrapper, node);
    }

    processDocument() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) nodes.push(node);
        
        // 非同期で処理して重いDOM操作を分散
        nodes.forEach((node, index) => {
            setTimeout(() => {
                this.processNode(node);
            }, index * 0);
        });
    }

}

document.addEventListener('DOMContentLoaded', () => {
    const rwb = new ResponsiveWordBreak();
    rwb.init();
});


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