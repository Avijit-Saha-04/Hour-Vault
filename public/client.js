const socket = io();

// --- STATE MANAGEMENT ---
let currentRoomCode = null;
let currentUsername = null;

// --- DOM ELEMENTS ---
const homeContainer = document.getElementById('home-container');
const chatContainer = document.getElementById('chat-container');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const roomCodeDisplay = document.getElementById('room-code-display');

// Home Screen Buttons & Inputs
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createUsernameInput = document.getElementById('create-username-input');
const deletionTimeSelect = document.getElementById('deletion-time');
const joinUsernameInput = document.getElementById('join-username-input');
const roomCodeInput = document.getElementById('room-code-input');


// --- UTILITY FUNCTIONS ---
function showChatView() {
    homeContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}

function showHomeView() {
    homeContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
}

function displayMessage(message, sender, type = 'theirs') {
    const div = document.createElement('div');
    div.classList.add('message', type);
    
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = sender;
    
    div.appendChild(senderSpan);
    div.appendChild(document.createTextNode(message));
    
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll
}

function displayNotification(text) {
    const div = document.createElement('div');
    div.classList.add('notification');
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- ENCRYPTION/DECRYPTION ---
// The room code is used as the secret key
function encryptMessage(message, key) {
    return CryptoJS.AES.encrypt(message, key).toString();
}

function decryptMessage(encryptedMessage, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}


// --- EVENT LISTENERS (Buttons) ---
createRoomBtn.addEventListener('click', () => {
    const username = createUsernameInput.value.trim();
    if (!username) {
        alert('Please enter a username.');
        return;
    }
    currentUsername = username;
    const deletionTime = parseInt(deletionTimeSelect.value, 10);
    socket.emit('createRoom', { deletionTime, username });
});

joinRoomBtn.addEventListener('click', () => {
    const username = joinUsernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!username || !roomCode) {
        alert('Please enter a username and room code.');
        return;
    }
    currentUsername = username;
    currentRoomCode = roomCode;
    socket.emit('joinRoom', { roomCode, username });
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message && currentRoomCode) {
        // Encrypt the message
        const encryptedMessage = encryptMessage(message, currentRoomCode);

        // Send the encrypted message to the server to be stored and broadcast
        socket.emit('sendMessage', { roomCode: currentRoomCode, encryptedMessage });
        
        messageInput.value = '';
    }
});


// --- SOCKET.IO EVENT HANDLERS (Receiving from server) ---
socket.on('roomCreated', (roomCode) => {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode;
    alert(`Room created! Your code is: ${roomCode}\nShare it with others to join.`);
    showChatView();
    displayNotification(`You created and joined room ${roomCode}.`);
});

socket.on('joinSuccess', ({ chatHistory }) => {
    roomCodeDisplay.textContent = currentRoomCode;
    showChatView();
    displayNotification(`You joined room ${currentRoomCode}.`);

    // Clear the message board and display all past messages from history
    messagesDiv.innerHTML = ''; 
    chatHistory.forEach(msg => {
        try {
            const decryptedMessage = decryptMessage(msg.encryptedMessage, currentRoomCode);
            // Determine if the historical message was 'mine' or 'theirs'
            const messageType = msg.sender === currentUsername ? 'mine' : 'theirs';
            const displayName = msg.sender === currentUsername ? 'You' : msg.sender;
            displayMessage(decryptedMessage, displayName, messageType);
        } catch (e) {
            console.error("Failed to decrypt a historical message:", e);
        }
    });
});

socket.on('userJoined', (message) => {
    displayNotification(message);
});

socket.on('userLeft', (message) => {
    displayNotification(message);
});

socket.on('receiveMessage', ({ encryptedMessage, sender }) => {
    try {
        // Decrypt the incoming message
        const decryptedMessage = decryptMessage(encryptedMessage, currentRoomCode);
        
        // Determine if the message is from us or someone else
        const messageType = sender === currentUsername ? 'mine' : 'theirs';
        const displayName = sender === currentUsername ? 'You' : sender;
        
        displayMessage(decryptedMessage, displayName, messageType);
    } catch (e) {
        console.error("Failed to decrypt message:", e);
        displayNotification(`[Could not decrypt a message from ${sender}]`);
    }
});

socket.on('roomDeleted', (message) => {
    alert(message);
    showHomeView();
    // Reset state
    messagesDiv.innerHTML = '';
    currentRoomCode = null;
    currentUsername = null;
});

socket.on('error', (message) => {
    alert(`Error: ${message}`);
});