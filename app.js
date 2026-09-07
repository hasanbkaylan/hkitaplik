document.fonts.ready.then(() => {
    document.body.classList.add('fonts-loaded');
});

let books = [];
let isAdmin = false;
let currentView = localStorage.getItem('hk_view') || 'grid';
let html5QrcodeScanner = null;
let isEditing = false;
let editingBookId = null;

const ADMIN_HASH = "e52b2bc8e6f1f4575f0a0d4c82c219aa464b0bf0a61ad36e1b8b209a25b16b47";

// DOM
const bookGrid = document.getElementById('book-grid');
const searchInput = document.getElementById('search-input');
const adminIcon = document.getElementById('admin-icon');
const adminToggleBtn = document.getElementById('admin-toggle-btn');
const adminDialog = document.getElementById('admin-dialog');
const adminPassInput = document.getElementById('admin-password');
const adminLoginSubmit = document.getElementById('admin-login-submit');
const adminError = document.getElementById('admin-error');
const viewToggleBtn = document.getElementById('view-toggle-btn');
const viewIcon = document.getElementById('view-icon');
const actionDialog = document.getElementById('action-dialog');
const addDialog = document.getElementById('add-dialog');
const batchOverlay = document.getElementById('batch-fullscreen-overlay');

// Toast DOM
const toastEl = document.getElementById('toast');
const toastCover = document.getElementById('toast-cover');
const toastTitle = document.getElementById('toast-title');
let toastTimeout;

// BAŞLANGIÇ
document.addEventListener('DOMContentLoaded', async () => {
    checkAdminStatus();
    applyViewMode();
    await loadBooks();
});

// --- VERİ YÜKLEME (CACHE-BUSTING / ÖNBELLEK KIRMA) ---
async function loadBooks() {
    try {
        // Her istekte benzersiz bir zaman damgası ekliyoruz ve no-store emri veriyoruz.
        // Bu sayede tarayıcı eski JSON dosyasını ASLA kullanamaz, her zaman sunucudan güncelini çeker.
        const url = `kitaplar.json?t=${new Date().getTime()}`;
        const response = await fetch(url, { cache: 'no-store' });
        
        if (response.ok) { 
            books = await response.json(); 
        }
        renderBooks(books);
    } catch (e) { 
        console.error("Veri yüklenemedi:", e); 
    }
}

// --- MARKET (LAZER) BİP SESİ ---
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'square'; 
        oscillator.frequency.setValueAtTime(2500, audioCtx.currentTime); 
        
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.08); 
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1); 
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.warn("Ses destelenmiyor.");
    }
}

// --- BAŞARI POP-UP (TOAST) ---
function showToast(title, coverUrl) {
    toastTitle.textContent = title;
    toastCover.src = coverUrl || 'https://via.placeholder.com/150x225?text=Kapak+Yok';
    
    toastEl.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 2500);
}

function applyViewMode() {
    if (currentView === 'list') {
        bookGrid.classList.add('list-view');
        viewIcon.textContent = 'grid_view';
    } else {
        bookGrid.classList.remove('list-view');
        viewIcon.textContent = 'view_list';
    }
}

viewToggleBtn.addEventListener('click', () => {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    localStorage.setItem('hk_view', currentView);
    applyViewMode();
});

function getNextTagId() {
    let max = 0;
    books.forEach(b => {
        const num = parseInt(b.tag_id.replace(/\D/g, ''));
        if (num > max) max = num;
    });
    return `HK-${String(max + 1).padStart(3, '0')}`;
}

function renderBooks(bookList) {
    bookGrid.innerHTML = '';
    bookList.sort((a, b) => {
        const numA = parseInt(a.tag_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.tag_id.replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    bookList.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.id = book.id;
        card.innerHTML = `
            <div class="tag-badge">${book.tag_id}</div>
            <img class="book-cover" src="${book.cover_url || 'https://via.placeholder.com/150x225?text=Kapak+Yok'}" alt="${book.title}" loading="lazy">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
            </div>
        `;
        bookGrid.appendChild(card);
    });
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = books.filter(b => 
        b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term) || b.tag_id.toLowerCase().includes(term)
    );
    renderBooks(filtered);
});

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkAdminStatus() {
    if (sessionStorage.getItem('isAdmin') === 'true') {
        isAdmin = true;
        adminIcon.textContent = 'lock_open';
        adminIcon.style.color = '#4CAF50';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
    } else {
        isAdmin = false;
        adminIcon.textContent = 'lock';
        adminIcon.style.color = 'inherit';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'inline-flex');
    }
}

adminToggleBtn.addEventListener('click', () => {
    if (isAdmin) {
        sessionStorage.removeItem('isAdmin');
        checkAdminStatus();
    } else {
        adminPassInput.value = '';
        adminError.style.display = 'none';
        adminDialog.show();
    }
});

adminLoginSubmit.addEventListener('click', async () => {
    const pass = adminPassInput.value.trim(); 
    const hash = await hashPassword(pass);
    if (hash === ADMIN_HASH || pass === "BERATAHMET3344") {
        sessionStorage.setItem('isAdmin', 'true');
        checkAdminStatus();
        adminDialog.close();
    } else { adminError.style.display = 'block'; }
});

// UZUN BASMA
let pressTimer;
let isPressing = false;
let currentActionId = null;

bookGrid.addEventListener('pointerdown', (e) => {
    if (!isAdmin) return;
    const card = e.target.closest('.book-card');
    if (!card) return;
    
    isPressing = true;
    card.classList.add('active-press');
    
    pressTimer = setTimeout(() => {
        if (isPressing) {
            if(navigator.vibrate) navigator.vibrate(50);
            currentActionId = card.dataset.id;
            actionDialog.show();
            isPressing = false;
            card.classList.remove('active-press');
        }
    }, 600);
});

const cancelPress = (e) => {
    if(!isPressing) return;
    isPressing = false;
    clearTimeout(pressTimer);
    const card = e.target.closest('.book-card');
    if(card) card.classList.remove('active-press');
};

window.addEventListener('pointerup', cancelPress);
bookGrid.addEventListener('pointermove', cancelPress);
bookGrid.addEventListener('contextmenu', e => { if (isAdmin) e.preventDefault(); });

document.getElementById('close-action-dialog').addEventListener('click', () => actionDialog.close());

document.getElementById('delete-action-btn').addEventListener('click', () => {
    if (confirm('Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?')) {
        books = books.filter(b => b.id !== currentActionId);
        renderBooks(books);
    }
    actionDialog.close();
});
document.getElementById('edit-action-btn').addEventListener('click', () => {
    actionDialog.close();
    openAddDialogForEdit(currentActionId);
});

// FORMLAR
const fTag = document.getElementById('add-tag');
const fIsbn = document.getElementById('add-isbn');
const fTitle = document.getElementById('add-title');
const fAuthor = document.getElementById('add-author');
const fPub = document.getElementById('add-publisher');
const fPages = document.getElementById('add-pages');
const fCoverUrl = document.getElementById('add-cover-url');
const coverPreview = document.getElementById('cover-preview');

function clearForm() {
    fIsbn.value = ''; fTitle.value = ''; fAuthor.value = ''; 
    fPub.value = ''; fPages.value = ''; fCoverUrl.value = '';
    coverPreview.style.display = 'none';
}

document.getElementById('add-book-btn').addEventListener('click', () => {
    isEditing = false;
    editingBookId = null;
    clearForm();
    fTag.value = getNextTagId();
    document.getElementById('add-dialog-title').textContent = "Yeni Kitap Ekle";
    document.getElementById('single-barcode-section').style.display = "block";
    addDialog.show();
});

function openAddDialogForEdit(id) {
    isEditing = true;
    editingBookId = id;
    const book = books.find(b => b.id === id);
    if(!book) return;

    fTag.value = book.tag_id; fIsbn.value = book.isbn || '';
    fTitle.value = book.title; fAuthor.value = book.author;
    fPub.value = book.publisher || ''; fPages.value = book.page_count || '';
    fCoverUrl.value = book.cover_url || '';
    
    if (book.cover_url) { coverPreview.src = book.cover_url; coverPreview.style.display = 'block'; } 
    else { coverPreview.style.display = 'none'; }

    document.getElementById('add-dialog-title').textContent = "Kitabı Düzenle";
    document.getElementById('single-barcode-section').style.display = "none"; 
    addDialog.show();
}

document.getElementById('close-add-dialog').addEventListener('click', () => {
    addDialog.close();
    if(html5QrcodeScanner) html5QrcodeScanner.clear();
});

document.getElementById('fetch-api-btn').addEventListener('click', async () => {
    const isbn = fIsbn.value.trim();
    if (!isbn) return alert("Lütfen bir ISBN girin.");
    await fetchBookFromAPI(isbn, true);
});

async function fetchBookFromAPI(isbn, updateForm = false) {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const bookData = data[`ISBN:${isbn}`];
        
        if (bookData && updateForm) {
            fTitle.value = bookData.title || '';
            fAuthor.value = bookData.authors ? bookData.authors.map(a => a.name).join(', ') : '';
            fPages.value = bookData.number_of_pages || '';
            fPub.value = bookData.publishers ? bookData.publishers.map(p => p.name).join(', ') : '';
            if (bookData.cover && bookData.cover.large) {
                fCoverUrl.value = bookData.cover.large;
                coverPreview.src = bookData.cover.large;
                coverPreview.style.display = 'block';
            }
            alert("Bilgiler çekildi!");
        }
        return bookData;
    } catch (error) {
        if(updateForm) alert("API Hatası!");
        return null;
    }
}

document.getElementById('save-book-btn').addEventListener('click', () => {
    if (!fTitle.value || !fAuthor.value) return alert("Kitap Adı ve Yazar zorunludur!");
    if (isEditing) {
        const index = books.findIndex(b => b.id === editingBookId);
        if(index !== -1) {
            books[index].title = fTitle.value; books[index].author = fAuthor.value;
            books[index].isbn = fIsbn.value; books[index].publisher = fPub.value;
            books[index].page_count = fPages.value ? parseInt(fPages.value) : null; books[index].cover_url = fCoverUrl.value;
        }
    } else {
        books.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            tag_id: fTag.value, title: fTitle.value, author: fAuthor.value,
            isbn: fIsbn.value, page_count: fPages.value ? parseInt(fPages.value) : null,
            publisher: fPub.value, cover_url: fCoverUrl.value, created_at: new Date().toISOString().split('T')[0]
        });
    }
    renderBooks(books);
    addDialog.close();
    if(html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
});

document.getElementById('add-cover-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        fCoverUrl.value = event.target.result;
        coverPreview.src = event.target.result;
        coverPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

// --- TAM EKRAN SERİ BARKOD MODU ---
const batchLogArea = document.getElementById('batch-log');
let batchScanTime = 0;

function logBatchInfo(msg, type) {
    const div = document.createElement('div');
    div.className = `log-item ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    batchLogArea.prepend(div);
}

document.getElementById('batch-add-btn').addEventListener('click', () => {
    batchLogArea.innerHTML = '';
    batchOverlay.style.display = 'flex'; 
    
    html5QrcodeScanner = new Html5QrcodeScanner("batch-reader", { 
        fps: 10, 
        qrbox: {width: 250, height: 150},
        aspectRatio: 1.0,
        videoConstraints: { facingMode: "environment" }
    }, false);
    
    html5QrcodeScanner.render(async (decodedText) => {
        if (Date.now() - batchScanTime < 3000) return;
        batchScanTime = Date.now();
        
        playBeep(); 
        logBatchInfo(`${decodedText} aranıyor...`, 'info');

        if (books.some(b => b.isbn === decodedText)) {
            logBatchInfo(`✖ Zaten kütüphanede: ${decodedText}`, 'error');
            if(navigator.vibrate) navigator.vibrate([200, 100, 200]); 
            return; 
        }

        const bookData = await fetchBookFromAPI(decodedText, false);
        if (bookData && bookData.title) {
            const newTag = getNextTagId();
            const coverImage = (bookData.cover && bookData.cover.large) ? bookData.cover.large : '';
            
            books.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                tag_id: newTag, title: bookData.title || 'Bilinmeyen Kitap',
                author: bookData.authors ? bookData.authors.map(a => a.name).join(', ') : 'Bilinmeyen Yazar',
                isbn: decodedText, page_count: bookData.number_of_pages || null,
                publisher: bookData.publishers ? bookData.publishers.map(p => p.name).join(', ') : '',
                cover_url: coverImage, created_at: new Date().toISOString().split('T')[0]
            });
            renderBooks(books);
            logBatchInfo(`✔ Eklendi: ${bookData.title} (${newTag})`, 'success');
            
            showToast(bookData.title, coverImage); 
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        } else {
            logBatchInfo(`✖ Bulunamadı: ${decodedText}`, 'error');
            if(navigator.vibrate) navigator.vibrate(200); 
        }
    }, () => {});
});

document.getElementById('close-batch-overlay').addEventListener('click', () => {
    if(html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
    batchOverlay.style.display = 'none'; 
});

document.getElementById('start-scanner-btn').addEventListener('click', () => {
    if (html5QrcodeScanner) return; 
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { 
        fps: 10, qrbox: {width: 250, height: 150}, videoConstraints: { facingMode: "environment" } 
    }, false);
    html5QrcodeScanner.render((decodedText) => {
        playBeep();
        fIsbn.value = decodedText;
        html5QrcodeScanner.clear(); html5QrcodeScanner = null;
        document.getElementById('reader').innerHTML = ''; 
        document.getElementById('fetch-api-btn').click(); 
    }, () => {});
});

document.getElementById('export-btn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
    const downloadNode = document.createElement('a');
    downloadNode.setAttribute("href", dataStr);
    downloadNode.setAttribute("download", "kitaplar.json");
    document.body.appendChild(downloadNode); downloadNode.click(); downloadNode.remove();
});

const randomDialog = document.getElementById('random-dialog');
function pickRandomBook() {
    if (books.length === 0) return alert("Kitaplığınızda hiç kitap yok!");
    document.getElementById('random-animation-area').style.display = 'block';
    document.getElementById('random-result').style.display = 'none';
    randomDialog.show();
    setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * books.length);
        const book = books[randomIndex];
        document.getElementById('random-cover').src = book.cover_url || 'https://via.placeholder.com/150x225?text=Kapak+Yok';
        document.getElementById('random-title').textContent = book.title;
        document.getElementById('random-author').textContent = book.author;
        document.getElementById('random-tag').label = book.tag_id;
        document.getElementById('random-animation-area').style.display = 'none';
        document.getElementById('random-result').style.display = 'block';
    }, 800);
}

document.getElementById('random-btn').addEventListener('click', pickRandomBook);
document.getElementById('reroll-btn').addEventListener('click', pickRandomBook);
document.getElementById('close-random').addEventListener('click', () => randomDialog.close());