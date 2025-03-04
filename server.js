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
  .then(() => console.log('✅ Conectado a la base de datos MongoDB'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

app.use('/api', authRoutes);

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*" }  
});

io.on('connection', (socket) => {
  console.log('🟢 Nuevo usuario conectado:', socket.id);


  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`🔵 Usuario ${userId} unido a su sala privada.`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado:', socket.id);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
