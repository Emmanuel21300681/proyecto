require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { db } = require('./firebase');
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendario');
const notificationRoutes = require('./routes/notificaciones');
const eventoRoutes = require('./routes/evento');
const liveRoutes = require('./routes/live');
const groupRoutes = require('./routes/group');
const User = require('./models/User');
const path = require('path');

const app = express();

// Servir archivos estáticos (como default-group.png)
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(bodyParser.json());
app.use('/api/calendario', calendarRoutes);
app.use('/api/notificaciones', notificationRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api', authRoutes);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch((err) => console.error('❌ Error MongoDB:', err));

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*" }
});

async function syncUserToFirebase(user) {
  try {
    await db.collection('users').doc(user._id.toString()).set({
      email: user.email,
      username: user.username,
      fotoPerfil: user.fotoPerfil || '',
      cuentaPrivada: user.cuentaPrivada || false
    });
    console.log(`✅ Usuario ${user.username} sincronizado con Firebase`);
  } catch (error) {
    console.error('❌ Error sincronizando usuario con Firebase:', error);
  }
}

// Rutas para usuarios y chats
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username fotoPerfil _id');
    res.json(users);
  } catch (error) {
    console.error("❌ Error obteniendo usuarios:", error);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId, 'username fotoPerfil email cuentaPrivada');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error("❌ Error obteniendo usuario:", error);
    res.status(500).json({ error: 'Error obteniendo usuario' });
  }
});

app.get('/api/chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Fetching chats for userId: ${userId}`);

    let chatsSnapshot;
    try {
      chatsSnapshot = await db.collection('chats')
        .where('participants', 'array-contains', userId)
        .get();
    } catch (firestoreError) {
      console.warn('⚠️ Error al consultar Firestore:', firestoreError.message);
      return res.status(200).json([]);
    }

    if (chatsSnapshot.empty) {
      return res.status(200).json([]);
    }

    const chats = [];
    for (const doc of chatsSnapshot.docs) {
      const data = doc.data();
      const otherUserId = data.participants.find(id => id !== userId);
      const otherUser = await User.findById(otherUserId, 'username fotoPerfil');
      if (!otherUser) continue;

      chats.push({
        chatId: doc.id,
        otherUser: {
          id: otherUserId,
          username: otherUser.username || 'Usuario desconocido',
          fotoPerfil: otherUser.fotoPerfil || '/default-group.png'
        },
        lastMessage: data.lastMessage || 'Inicia una conversación'
      });
    }
    res.json(chats);
  } catch (error) {
    console.error("❌ Error obteniendo chats:", error);
    res.status(500).json({ error: 'Error obteniendo chats', message: error.message });
  }
});

app.post('/api/chats/create', async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;
    const chatId = [userId, otherUserId].sort().join('_');

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      await chatRef.set({
        participants: [userId, otherUserId],
        createdAt: new Date().toISOString()
      });
    }

    res.json({ chatId });
  } catch (error) {
    console.error("❌ Error creando chat:", error);
    res.status(500).json({ error: 'Error creando chat', message: error.message });
  }
});

app.get('/api/users/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error("❌ Error obteniendo usuario por email:", error);
    res.status(500).json({ error: 'Error obteniendo usuario' });
  }
});

// Rutas de Perfil
app.post('/api/perfil/datos', async (req, res) => {
  console.log('Solicitud recibida en /perfil/datos');
  console.log('Body:', req.body);

  const { email } = req.body;

  if (!email) {
    console.error('Falta el campo email');
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });
    console.log('Usuario encontrado:', user);

    if (!user) {
      console.error('Usuario no encontrado');
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    res.status(200).json({
      success: true,
      fotoPerfil: user.fotoPerfil,
      username: user.username,
      dob: user.dob,
      tipoUsuario: user.tipoUsuario,
      deporte: user.deporte,
      nivel: user.nivel,
      logros: user.logros,
      biografia: user.biografia,
      nombre: user.nombre,
      genero: user.genero,
      ubicacion: user.ubicacion,
      contenido: user.publicaciones,
      cuentaPrivada: user.cuentaPrivada || false,
      publicaciones: user.publicaciones
    });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

app.post('/api/perfil/no-seguidos', async (req, res) => {
  try {
    const { email, amigoEmail } = req.body;
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const sonAmigos = user.amigos && user.amigos.includes(amigo._id);
    const solicitudPendiente = user.solicitudesEnviadas && user.solicitudesEnviadas.includes(amigo._id);

    res.json({ success: true, sonAmigos, solicitudPendiente });
  } catch (error) {
    console.error('Error verificando seguimiento:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/perfil/agregar-amigo', async (req, res) => {
  try {
    const { email, amigoEmail } = req.body;
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!user.amigos) user.amigos = [];
    if (!amigo.amigos) amigo.amigos = [];

    if (!user.amigos.includes(amigo._id)) {
      user.amigos.push(amigo._id);
      amigo.amigos.push(user._id);
      await user.save();
      await amigo.save();
    }

    res.json({ success: true, message: 'Amigo agregado' });
  } catch (error) {
    console.error('Error agregando amigo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/perfil/eliminar-amigo-unilateral', async (req, res) => {
  try {
    const { email, amigoEmail } = req.body;
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    user.amigos = user.amigos.filter(id => id.toString() !== amigo._id.toString());
    amigo.amigos = amigo.amigos.filter(id => id.toString() !== user._id.toString());

    await user.save();
    await amigo.save();

    res.json({ success: true, message: 'Amigo eliminado' });
  } catch (error) {
    console.error('Error eliminando amigo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/perfil/mandar-solicitud', async (req, res) => {
  try {
    const { email, amigoEmail } = req.body;
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!user.solicitudesEnviadas) user.solicitudesEnviadas = [];
    if (!amigo.solicitudesRecibidas) amigo.solicitudesRecibidas = [];

    if (!user.solicitudesEnviadas.includes(amigo._id)) {
      user.solicitudesEnviadas.push(amigo._id);
      amigo.solicitudesRecibidas.push(user._id);
      await user.save();
      await amigo.save();
    }

    res.json({ success: true, message: 'Solicitud enviada' });
  } catch (error) {
    console.error('Error enviando solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/perfil/cancelar-solicitud', async (req, res) => {
  try {
    const { email, amigoEmail } = req.body;
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    user.solicitudesEnviadas = user.solicitudesEnviadas.filter(id => id.toString() !== amigo._id.toString());
    amigo.solicitudesRecibidas = amigo.solicitudesRecibidas.filter(id => id.toString() !== user._id.toString());

    await user.save();
    await amigo.save();

    res.json({ success: true, message: 'Solicitud cancelada' });
  } catch (error) {
    console.error('Error cancelando solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Manejo de WebSocket
io.on('connection', (socket) => {
  console.log('🟢 Nuevo usuario conectado:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`🔵 Usuario ${userId} unido a su sala privada`);
  });

  socket.on('sendMessage', async ({ senderId, receiverId, content, imageUrl }) => {
    try {
      const message = {
        senderId,
        receiverId,
        content: content || '',
        imageUrl: imageUrl || null,
        timestamp: new Date().toISOString()
      };

      const chatId = [senderId, receiverId].sort().join('_');
      const chatRef = db.collection('chats').doc(chatId);

      await chatRef.collection('messages').add(message);
      await chatRef.update({
        lastMessage: imageUrl ? '[Imagen]' : content,
        lastMessageTime: message.timestamp
      });

      io.to(senderId).to(receiverId).emit('newMessage', message);
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
    }
  });

  socket.on('sendGroupMessage', async ({ groupId, senderId, content, imageUrl }) => {
    try {
      const message = {
        id: Date.now().toString(), // Temporal hasta que tengas una colección real
        groupId,
        senderId,
        content: content || '',
        imageUrl: imageUrl || null,
        timestamp: new Date().toISOString()
      };

      // Simular almacenamiento de mensajes (deberías crear una colección en Firestore o MongoDB)
      io.to(groupId).emit('newGroupMessage', message);
    } catch (error) {
      console.error('❌ Error enviando mensaje de grupo:', error);
    }
  });

  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`🔵 Usuario ${socket.id} unido al grupo ${groupId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado:', socket.id);
  });
});

app.set('io', io);

app.get('/firebase.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`
    window.firebaseConfig = {
      apiKey: "${process.env.FIREBASE_API_KEY}",
      authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
      projectId: "${process.env.FIREBASE_PROJECT_ID}",
      storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
      messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
      appId: "${process.env.FIREBASE_APP_ID}",
      measurementId: "${process.env.FIREBASE_MEASUREMENT_ID}"
    };
  `);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});