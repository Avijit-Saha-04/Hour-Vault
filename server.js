const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// This object will store our room data in memory
const rooms = {};

// Serve the static files from the 'public' directory
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // --- Room Creation ---
    socket.on('createRoom', ({ deletionTime, username }) => {
        // Generate a simple 6-character random room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Ensure the code is unique
        if (rooms[roomCode]) {
            socket.emit('error', 'Could not create room, please try again.');
            return;
        }

        // Store room info and set up auto-deletion
        rooms[roomCode] = {
            users: new Set(), // Use a Set to store unique user IDs
            creator: socket.id,
            messages: [], // Array to store chat history
            // Set deletion timeout
            timeout: setTimeout(() => {
                // Notify everyone in the room before deleting
                io.to(roomCode).emit('roomDeleted', 'This room has expired and is now closed.');
                // Clean up the room data
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted due to timeout.`);
            }, deletionTime)
        };
        
        // Join the socket to the new room
        socket.join(roomCode);
        // Add the creator's ID to the list of users
        rooms[roomCode].users.add(socket.id);
        // Store the creator's data on their socket object
        socket.data.username = username;
        socket.data.roomCode = roomCode;
        
        console.log(`Room created: ${roomCode} by ${username} (${socket.id}). Deletes in ${deletionTime / 1000}s.`);
        
        // The client-side 'roomCreated' event still works the same
        socket.emit('roomCreated', roomCode);
    });

    // --- Room Joining ---
    socket.on('joinRoom', ({ roomCode, username }) => {
        if (!rooms[roomCode]) {
            socket.emit('error', 'Room does not exist.');
            return;
        }
        if (rooms[roomCode].users.size >= 10) {
            socket.emit('error', 'Room is full.');
            return;
        }
        
        socket.join(roomCode);
        rooms[roomCode].users.add(socket.id);
        socket.data.username = username; // Store username on the socket object
        socket.data.roomCode = roomCode;
        
        // Notify others in the room
        socket.to(roomCode).emit('userJoined', `${username} has joined the chat.`);
        
        // Send existing chat history to the newly joined user
        socket.emit('joinSuccess', {
            chatHistory: rooms[roomCode].messages
        });

        console.log(`${username} (${socket.id}) joined room: ${roomCode}`);
    });

    // --- Message Handling ---
    socket.on('sendMessage', ({ roomCode, encryptedMessage }) => {
        // Create the message object to store and send
        const messageData = { 
            encryptedMessage, 
            sender: socket.data.username 
        };

        // Store the new message in the room's history
        if (rooms[roomCode]) {
            rooms[roomCode].messages.push(messageData);
        }

        // Broadcast the new message to everyone in the room (including the sender)
        io.to(roomCode).emit('receiveMessage', messageData);
    });

    // --- Disconnect Handling ---
    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
        const { roomCode, username } = socket.data;
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].users.delete(socket.id);
            // Notify remaining users
            io.to(roomCode).emit('userLeft', `${username} has left the chat.`);
        }
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});