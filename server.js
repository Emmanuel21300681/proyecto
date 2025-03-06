// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendario');
const notificationRoutes = require('./routes/notificaciones');
const eventoRoutes = require('./routes/evento');
const liveRoutes = require('./routes/live');

// Importar Firebase desde config/firebase.js
const { db, storage } = require('./config/firebase'); // Ajusta la ruta según donde hayas puesto firebase.js
const { collection, addDoc, getDocs, query, where, orderBy } = require('firebase/firestore');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use('/api/calendario', calendarRoutes);
app.use('/api/notificaciones', notificationRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/live', liveRoutes);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a la base de datos MongoDB'))
  .catch((err) => console.error('Error al conectar a MongoDB:', err));

app.use('/api', authRoutes);

// Rutas para los chats
app.get('/api/chats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId));
    const snapshot = await getDocs(q);
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, chats });
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`Usuario ${userId} unido a su sala privada.`);
  });

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`Usuario unido al chat ${chatId}`);
  });

  socket.on('sendMessage', async ({ chatId, senderId, content, type, imageUrl }) => {
    try {
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const newMessage = {
        sender: senderId,
        content: content || '',
        imageUrl: imageUrl || '',
        type: type || 'text',
        timestamp: new Date().toISOString(),
      };
      await addDoc(messagesRef, newMessage);
      io.to(chatId).emit('newMessage', newMessage);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});