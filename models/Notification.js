const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  tipo: { type: String, required: true }, // "nuevo_seguidor", "like", "comentario"
  usuarioDestino: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usuarioOrigen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mensaje: { type: String, required: true },
  leida: { type: Boolean, default: false },
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
