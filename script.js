class FormatadorRetornoDMC {
    constructor() {
        this.outputSection = document.getElementById('outputSection');
        this.formattedOutput = document.getElementById('formattedOutput');
        this.rawTextarea = document.getElementById('rawText');
        this.resultsCount = document.getElementById('resultsCount');
        
        this.init();
    }

    init() {
        // Auto-focus no textarea quando a página carrega
        window.addEventListener('load', () => {
            this.rawTextarea.focus();
        });

        // Atalho de teclado Ctrl+Enter para formatar
        this.rawTextarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.formatText();
            }
        });
    }

    formatText() {
        const rawText = this.rawTextarea.value.trim();
        
        if (!rawText) {
            this.showError('Por favor, cole o texto do retorno DMC primeiro!');
            return;
        }

        try {
            // Separar múltiplos textos
            const textos = this.separateMultipleTexts(rawText);
            
            if (textos.length === 0) {
                this.showError('Nenhum texto válido encontrado. Verifique o formato.');
                return;
            }

            // Parse de cada texto
            const parsedTexts = textos.map(texto => this.parseRetornoDMC(texto));
            
            // Gerar HTML formatado para todos
            const formattedHTML = this.generateMultipleFormattedHTML(parsedTexts);
            
            this.formattedOutput.innerHTML = formattedHTML;
            this.updateResultsCount(parsedTexts.length);
            this.outputSection.style.display = 'block';
            
            // Scroll para o resultado
            this.outputSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            this.showError('Erro ao processar o texto: ' + error.message);
        }
    }

    separateMultipleTexts(rawText) {
        // Dividir por separadores comuns
        let separators = [
            /={3,}/g,           // ===
            /-{10,}/g,          // ----------
            /#{3,}/g,           // ###
            /\*{3,}/g           // ***
        ];

        // Primeiro, tentar dividir por separadores explícitos
        let texts = [rawText];
        
        separators.forEach(separator => {
            let newTexts = [];
            texts.forEach(text => {
                newTexts.push(...text.split(separator));
            });
            texts = newTexts;
        });

        // Filtrar textos válidos (que contenham pelo menos alguns campos DMC)
        const validTexts = texts
            .map(text => text.trim())
            .filter(text => text.length > 20) // Mínimo de caracteres
            .filter(text => 
                text.toLowerCase().includes('retorno') ||
                text.toLowerCase().includes('dmc') ||
                text.toLowerCase().includes('setor') ||
                text.toLowerCase().includes('domicílio') ||
                text.toLowerCase().includes('morador')
            );

        // Se não encontrou textos válidos pelos separadores, 
        // tentar dividir por quebras de linha duplas
        if (validTexts.length <= 1 && rawText.includes('\n\n')) {
            const paragraphs = rawText.split(/\n\s*\n/)
                .map(p => p.trim())
                .filter(p => p.length > 50);
            
            if (paragraphs.length > 1) {
                return paragraphs;
            }
        }

        return validTexts.length > 0 ? validTexts : [rawText];
    }

    parseRetornoDMC(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const parsed = {
            originalText: text,
            fields: {},
            explanation: '',
            copyNote: '',
            entrevistador: '',
            title: 'RETORNO AO DMC'
        };
        
        let explanationText = '';
        let collectingExplanation = false;
        
        for (let line of lines) {
            // Título principal
            if (line.includes('RETORNO AO DMC') || (line.includes('===') && line.toLowerCase().includes('retorno'))) {
                continue;
            }
            
            // Separador final
            if (line.match(/^[-=*#]{5,}$/)) {
                collectingExplanation = false;
                continue;
            }
            
            // Entrevistador
            if (line.toLowerCase().startsWith('entrevistador:')) {
                parsed.entrevistador = line.replace(/^entrevistador:\s*/i, '');
                continue;
            }
            
            // Nota sobre cópia da entrevista
            if (line.toLowerCase().includes('cópia da entrevista') || 
                line.toLowerCase().includes('só avisar') ||
                line.toLowerCase().includes('se quiser')) {
                parsed.copyNote = line;
                continue;
            }
            
            // Detectar início da explicação
            if (line.toLowerCase().startsWith('explicação:')) {
                collectingExplanation = true;
                explanationText = line.replace(/^explicação:\s*/i, '');
                continue;
            }
            
            // Coletar texto da explicação
            if (collectingExplanation) {
                explanationText += ' ' + line;
                continue;
            }
            
            // Parse dos campos principais
            if (line.includes(':')) {
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                
                if (key && value) {
                    parsed.fields[key.toLowerCase()] = value;
                }
            }
        }
        
        if (explanationText.trim()) {
            parsed.explanation = explanationText.trim();
        }
        
        return parsed;
    }

    generateMultipleFormattedHTML(parsedTexts) {
        let html = '';
        
        parsedTexts.forEach((parsed, index) => {
            if (index > 0) {
                html += '<div class="separator"></div>';
            }
            html += this.generateSingleFormattedHTML(parsed, index + 1, parsedTexts.length);
        });
        
        return html;
    }

    generateSingleFormattedHTML(parsed, number, totalCount = 1) {
        const title = totalCount > 1 ? 
            `📋 RETORNO AO DMC #${number}` : 
            '📋 RETORNO AO DMC';
        
        let html = '';
        
        // Mostrar Entrevistador fora do quadro principal (não copiável)
        if (parsed.entrevistador) {
            html += `<div class="entrevistador-container">
                      <div class="entrevistador-info">
                        <span class="entrevistador-label">👨‍💼 Entrevistador:</span>
                        <span class="entrevistador-value">${this.escapeHtml(parsed.entrevistador)}</span>
                      </div>
                      <button class="btn-copy-image" onclick="copyFormattedAsImage(this)" title="Copiar quadro como imagem">
                        📸 Copiar
                      </button>
                    </div>`;
        }
            
        html += `<div class="formatted-output">
                      <div class="dmc-title">${title}</div>`;
        
        // Campos principais com ordem específica
        const fieldOrder = [
            { key: 'setor', label: '🏢 Setor', inline: true },
            { key: 'domicílio', label: '🏠 Domicílio', inline: true },
            { key: 'morador', label: '👤 Morador', inline: true },
            { key: 'profissão', label: '💼 Profissão', inline: true },
            { key: 'o que arrumar', label: '🔧 O que arrumar', inline: false }
        ];
        
        // Adicionar campos na ordem específica
        fieldOrder.forEach(field => {
            if (parsed.fields[field.key]) {
                html += this.createInfoItem(field.label, parsed.fields[field.key], field.inline);
            }
        });
        
        // Adicionar outros campos não mapeados (inline por padrão para compacto)
        Object.keys(parsed.fields).forEach(key => {
            if (!fieldOrder.some(f => f.key === key)) {
                const label = '📌 ' + key.charAt(0).toUpperCase() + key.slice(1);
                html += this.createInfoItem(label, parsed.fields[key], true);
            }
        });
        
        // Explicação
        if (parsed.explanation) {
            html += `
                <div class="explanation-section">
                    <div class="explanation-title">💡 Explicação</div>
                    <div class="explanation-text">${this.escapeHtml(parsed.explanation)}</div>
                </div>
            `;
        }
        
        // Nota sobre cópia
        if (parsed.copyNote) {
            html += `
                <div class="copy-note">
                    📋 ${this.escapeHtml(parsed.copyNote)}
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    createInfoItem(label, value, inline = false) {
        const cleanedValue = this.cleanEmptyQuotes(value);
        
        if (inline) {
            return `
                <div class="info-item info-item-inline">
                    <span class="info-label-inline">${label}</span>
                    <span class="info-value-inline">${this.escapeHtml(cleanedValue)}</span>
                </div>
            `;
        } else {
            return `
                <div class="info-item">
                    <div class="info-label">${label}</div>
                    <div class="info-value">${this.escapeHtml(cleanedValue)}</div>
                </div>
            `;
        }
    }

    updateResultsCount(count) {
        const text = count === 1 ? 
            '📄 1 retorno processado' : 
            `📄 ${count} retornos processados`;
        this.resultsCount.textContent = text;
    }

    clearAll() {
        this.rawTextarea.value = '';
        this.outputSection.style.display = 'none';
        this.rawTextarea.focus();
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = '❌ ' + message;
        
        // Remover erro anterior se existir
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Inserir erro antes da área de texto
        const inputSection = document.querySelector('.input-section');
        const textarea = document.querySelector('textarea');
        inputSection.insertBefore(errorDiv, textarea);
        
        // Remover erro após 5 segundos
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanEmptyQuotes(text) {
        // Remove aspas duplas vazias ("") e substitui por aspa simples (")
        return text.replace(/""/g, '"');
    }}

// Gerenciador de Tema
class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = document.querySelector('.theme-icon');
        this.themeText = document.querySelector('.theme-text');
        
        this.init();
    }

    init() {
        // Carregar tema salvo ou usar modo escuro como padrão
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.themeIcon.textContent = '☀️';
            this.themeText.textContent = 'Modo Claro';
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.themeIcon.textContent = '🌙';
            this.themeText.textContent = 'Modo Escuro';
        }
        
        localStorage.setItem('theme', theme);
    }

    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
}

// Funções globais para os botões
function formatText() {
    formatador.formatText();
}

function clearAll() {
    formatador.clearAll();
}

function toggleTheme() {
    themeManager.toggle();
}

async function copyFormattedAsImage(buttonElement) {
    try {
        // Encontrar o quadro formatado mais próximo
        // O .formatted-output é irmão do .entrevistador-container, então procuramos no pai comum
        const container = buttonElement.closest('.entrevistador-container');
        const formattedOutput = container.nextElementSibling;
        
        if (!formattedOutput || !formattedOutput.classList.contains('formatted-output')) {
            alert('❌ Não foi possível encontrar o quadro para copiar.');
            return;
        }
        
        // Mudar o texto do botão para feedback
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = '⏳ Processando...';
        buttonElement.disabled = true;
        
        // Converter o HTML para imagem
        const canvas = await html2canvas(formattedOutput, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        // Converter canvas para blob
        canvas.toBlob(async (blob) => {
            try {
                // Copiar para a área de transferência
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                
                // Feedback de sucesso
                buttonElement.innerHTML = '✅ Copiado!';
                buttonElement.style.background = '#4CAF50';
                buttonElement.style.color = 'white';
                
                setTimeout(() => {
                    buttonElement.innerHTML = originalText;
                    buttonElement.style.background = '';
                    buttonElement.style.color = '';
                    buttonElement.disabled = false;
                }, 2000);
                
            } catch (error) {
                console.error('Erro ao copiar:', error);
                buttonElement.innerHTML = '❌ Erro na cópia';
                setTimeout(() => {
                    buttonElement.innerHTML = originalText;
                    buttonElement.disabled = false;
                }, 2000);
            }
        });
        
    } catch (error) {
        console.error('Erro ao gerar imagem:', error);
        alert('❌ Erro ao gerar a imagem. Verifique o console.');
        buttonElement.disabled = false;
    }
}

// Inicializar quando a página carregar
let formatador;
let themeManager;

document.addEventListener('DOMContentLoaded', function() {
    formatador = new FormatadorRetornoDMC();
    themeManager = new ThemeManager();
});