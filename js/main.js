let vocabData = {};
let currentLevelPool = [];
let currentWordObj = null;
let totalWordsInLevel = 0;
let isCardFlipped = false;

const themeToggle = document.getElementById('theme-toggle');
const header = document.getElementById('main-header');
const cardInner = document.getElementById('flash-card');
const cardScene = document.getElementById('card-scene');

let isDarkMode = false;
themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : '');
    themeToggle.textContent = isDarkMode ? '☀️ Chế Độ Sáng' : '🌙 Chế Độ Tối'; 
    if(!isDarkMode) document.body.removeAttribute('data-theme');
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId === 'play-screen') header.classList.add('zen-mode');
    else header.classList.remove('zen-mode');
}

// 1. BẢO MẬT: KHÓA CHUỘT PHẢI & PHÍM TẮT DEV
document.addEventListener('contextmenu', function(event) { event.preventDefault(); });
document.addEventListener('keydown', function(event) {
    if (
        event.keyCode === 123 || 
        (event.ctrlKey && event.shiftKey && event.keyCode === 73) || 
        (event.ctrlKey && event.shiftKey && event.keyCode === 74) || 
        (event.ctrlKey && event.keyCode === 85) || 
        (event.ctrlKey && event.keyCode === 83)    
    ) {
        event.preventDefault(); return false;
    }
});

// LOGIC XỬ LÝ DỮ LIỆU VÀ XÓA CACHE TỰ ĐỘNG
window.addEventListener('DOMContentLoaded', async () => {
    // ÉP TỪ VỰNG LUÔN TRÊN 1 DÒNG (Chống rớt chữ)
    document.getElementById('flash-word-front').style.whiteSpace = 'nowrap';
    document.getElementById('flash-word-back').style.whiteSpace = 'nowrap';

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`./vocabulary.txt?t=${timestamp}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('File not found');
        parseVocabText(await response.text());
        renderLevels();
    } catch (error) { showScreen('setup-screen'); }
});

document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { parseVocabText(e.target.result); renderLevels(); };
    reader.readAsText(file);
});

function parseVocabText(text) {
    vocabData = {};
    const lines = text.split('\n');
    let currentList = '', currentWord = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // NHẬN DIỆN MÀN CHƠI
        if (line.startsWith('*')) {
            currentList = line.substring(1).trim(); 
            vocabData[currentList] = []; 
            currentWord = null;
        } 
        // BẮT LỖI CỨNG CÁP: Chấp nhận mọi format (1., 1), 1-, hoặc lỡ thiếu dấu hai chấm :)
        else if (/^\d+[\.\)\-]?\s*/.test(line)) {
            const colonIndex = line.indexOf(':');
            let rawWord = '';
            let meaningPart = '';
            
            const numMatch = line.match(/^\d+[\.\)\-]?\s*/);
            const startIndex = numMatch ? numMatch[0].length : 0;
            
            if (colonIndex !== -1 && colonIndex > startIndex) {
                rawWord = line.substring(startIndex, colonIndex).trim();
                meaningPart = line.substring(colonIndex + 1).trim();
            } else {
                rawWord = line.substring(startIndex).trim(); // Bắt trọn chữ dù thiếu dấu ":"
                meaningPart = ''; 
            }

            let wordMain = rawWord;
            let wordType = '';
            const typeMatch = rawWord.match(/\s*\((.*?)\)\s*/);
            if (typeMatch) {
                wordType = `(${typeMatch[1]})`;
                wordMain = rawWord.replace(typeMatch[0], '').trim();
            }
            
            currentWord = { wordMain: wordMain, wordType: wordType, meaning: meaningPart };
            if (currentList) vocabData[currentList].push(currentWord);
        } 
        else if (currentWord) { 
            currentWord.meaning += '<br>' + line; 
        }
    }
}

function renderLevels() {
    const container = document.getElementById('level-container');
    container.innerHTML = '';
    for (const listName in vocabData) {
        if(vocabData[listName].length === 0) continue;
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerHTML = `${listName}<small>${vocabData[listName].length} từ</small>`;
        btn.onclick = () => startLevel(listName);
        container.appendChild(btn);
    }
    showScreen('level-screen');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// BỘ ĐẾM CHÍNH XÁC: "Từ: 1 / 200"
function updateProgress() {
    const remaining = currentLevelPool.length + (currentWordObj ? 1 : 0);
    const done = totalWordsInLevel - remaining + 1;
    let percent = (done / totalWordsInLevel) * 100;
    document.getElementById('progress-bar').style.width = Math.min(percent, 100) + '%';
    document.getElementById('stats-text').textContent = `${done} / ${totalWordsInLevel}`;
}

function autoScaleText() {
    const regions = [
        { container: document.querySelector('.card-front-section'), text: document.getElementById('flash-word-front') },
        { container: document.querySelector('.card-back-word-section'), text: document.getElementById('flash-word-back') },
        { container: document.querySelector('.card-back-meaning-section'), text: document.getElementById('flash-meaning') }
    ];
    regions.forEach(region => {
        region.text.style.fontSize = ''; 
        let maxFS = parseFloat(window.getComputedStyle(region.text).fontSize);
        let minFS = 14;
        let bestFS = minFS;

        if (region.container.scrollHeight <= Math.ceil(region.container.clientHeight) && region.text.scrollWidth <= region.text.clientWidth) {
            return;
        }

        region.text.style.opacity = '0'; 
        while (minFS <= maxFS) {
            let midFS = Math.floor((minFS + maxFS) / 2);
            region.text.style.fontSize = midFS + 'px';
            if (region.container.scrollHeight > Math.ceil(region.container.clientHeight) || region.text.scrollWidth > region.text.clientWidth) {
                maxFS = midFS - 1; 
            } else {
                bestFS = midFS; 
                minFS = midFS + 1;
            }
        }
        region.text.style.fontSize = bestFS + 'px';
        region.text.style.opacity = '1';
    });
}
window.addEventListener('resize', () => { if(currentWordObj) autoScaleText(); });

function showNextWordData() {
    if (currentLevelPool.length === 0) {
        showScreen('end-screen');
        return false;
    }
    
    currentWordObj = currentLevelPool.pop(); 
    updateProgress();

    document.getElementById('flash-word-front').textContent = currentWordObj.wordMain;
    document.getElementById('flash-type-front').textContent = currentWordObj.wordType;
    document.getElementById('flash-type-front').style.display = currentWordObj.wordType ? 'block' : 'none';
    
    document.getElementById('flash-word-back').textContent = currentWordObj.wordMain;
    document.getElementById('flash-type-back').textContent = currentWordObj.wordType;
    document.getElementById('flash-type-back').style.display = currentWordObj.wordType ? 'block' : 'none';
    
    document.getElementById('flash-meaning').innerHTML = currentWordObj.meaning;
    
    document.getElementById('btn-key').style.display = 'flex';
    document.getElementById('btn-note').style.display = 'none';
    document.getElementById('btn-done').style.display = 'none';
    
    requestAnimationFrame(autoScaleText);
    return true;
}

function startLevel(listName) {
    currentLevelPool = [...vocabData[listName]];
    totalWordsInLevel = currentLevelPool.length;
    shuffleArray(currentLevelPool);
    showScreen('play-screen');
    
    cardInner.style.transition = 'none';
    cardInner.classList.remove('is-flipped');
    isCardFlipped = false;
    
    showNextWordData();

    if ('speechSynthesis' in window) {
        const warmUp = new SpeechSynthesisUtterance('');
        warmUp.volume = 0;
        window.speechSynthesis.speak(warmUp);
    }
    
    requestAnimationFrame(() => { cardInner.style.transition = ''; });
}

function animateAndNext() {
    document.getElementById('btn-note').style.pointerEvents = 'none';
    document.getElementById('btn-done').style.pointerEvents = 'none';

    cardScene.classList.remove('animate-fly-in');
    cardScene.classList.add('animate-fly-out');
    
    const onFlyOutEnd = (e) => {
        if(e.animationName !== 'flyOutLeft') return;
        cardScene.removeEventListener('animationend', onFlyOutEnd); 

        cardInner.style.transition = 'none'; 
        cardInner.classList.remove('is-flipped');
        isCardFlipped = false;
        
        const hasNext = showNextWordData();
        
        if (hasNext) {
            requestAnimationFrame(() => {
                cardInner.style.transition = ''; 
                cardScene.classList.remove('animate-fly-out');
                cardScene.classList.add('animate-fly-in');
                
                const onFlyInEnd = (ev) => {
                    if(ev.animationName !== 'flyInRight') return;
                    cardScene.removeEventListener('animationend', onFlyInEnd); 
                    cardScene.classList.remove('animate-fly-in');
                    document.getElementById('btn-note').style.pointerEvents = 'auto';
                    document.getElementById('btn-done').style.pointerEvents = 'auto';
                };
                cardScene.addEventListener('animationend', onFlyInEnd);
            });
        } else {
            cardScene.classList.remove('animate-fly-out');
            cardInner.style.transition = '';
            document.getElementById('btn-note').style.pointerEvents = 'auto';
            document.getElementById('btn-done').style.pointerEvents = 'auto';
        }
    };
    
    cardScene.addEventListener('animationend', onFlyOutEnd);
}

function flipCard() {
    isCardFlipped = true;
    cardInner.classList.add('is-flipped');
    document.getElementById('btn-key').style.display = 'none';
    document.getElementById('btn-note').style.display = 'flex';
    document.getElementById('btn-done').style.display = 'flex';
}

function markDone() { 
    if(isCardFlipped) animateAndNext(); 
}

function markNote() {
    if(!isCardFlipped) return;
    if (currentLevelPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * currentLevelPool.length);
        currentLevelPool.splice(randomIndex, 0, currentWordObj); 
    } else {
        currentLevelPool.push(currentWordObj);
    }
    totalWordsInLevel++; 
    animateAndNext();
}

document.getElementById('btn-key').addEventListener('click', flipCard);
document.getElementById('btn-done').addEventListener('click', markDone);
document.getElementById('btn-note').addEventListener('click', markNote);

function playAudio(lang) {
    if ('speechSynthesis' in window && currentWordObj) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentWordObj.wordMain);
        utterance.lang = lang; 
        utterance.rate = 0.85; 
        window.speechSynthesis.speak(utterance);
    }
}

document.querySelectorAll('.btn-us').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); playAudio('en-US'); });
});
document.querySelectorAll('.btn-uk').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); playAudio('en-GB'); });
});

// PHÍM TẮT
document.addEventListener('keydown', (e) => {
    if (document.getElementById('play-screen').classList.contains('active')) {
        if (e.code === 'Space' || e.code === 'Enter') { 
            e.preventDefault(); 
            if (!isCardFlipped) flipCard(); 
        } 
        else if (e.code === 'ArrowRight' && isCardFlipped) { markDone(); } 
        else if (e.code === 'ArrowLeft' && isCardFlipped) { markNote(); } 
        else if (e.code === 'KeyS') { playAudio('en-US'); }
        else if (e.code === 'KeyK') { playAudio('en-GB'); }
    }
});

// Sự kiện nút Back
document.getElementById('btn-back').addEventListener('click', () => {
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); }
    showScreen('level-screen');
});
