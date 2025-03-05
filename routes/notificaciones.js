const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');



router.post('/nuevo-seguidor', async (req, res) => {
  const { emailSeguidor, emailSeguido } = req.body;

  if (!emailSeguidor || !emailSeguido) {
    return res.status(400).json({ success: false, message: 'Faltan datos.' });
  }

  try {
    const seguidor = await User.findOne({ email: emailSeguidor });
    const seguido = await User.findOne({ email: emailSeguido });

    if (!seguidor || !seguido) {
      return res.status(404).json({ success: false, message: 'Usuarios no encontrados.' });
    }

    if (seguido.cuentaPrivada) {
      return res.status(400).json({ success: false, message: 'Cuenta privada, no se genera notificación.' });
    }

    const nuevaNotificacion = new Notification({
      tipo: 'nuevo_seguidor',
      usuarioDestino: seguido._id,
      usuarioOrigen: seguidor._id,
      mensaje: `${seguidor.username} ha comenzado a seguirte.`
    });

    await nuevaNotificacion.save();


    const io = req.app.get('io'); 
    io.to(seguido._id.toString()).emit('nueva_notificacion', nuevaNotificacion);

    res.status(200).json({ success: true, message: 'Notificación creada correctamente.' });

  } catch (error) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/obtener', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El email es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const notificaciones = await Notification.find({ usuarioDestino: user._id })
      .populate('usuarioOrigen', 'username fotoPerfil email')  
      .sort({ fecha: -1 });

    res.status(200).json({ success: true, notificaciones });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/marcar-leida', async (req, res) => {
  const { notificacionId } = req.body;

  if (!notificacionId) {
    return res.status(400).json({ success: false, message: 'El ID de la notificación es obligatorio.' });
  }

  try {
    const notificacion = await Notification.findById(notificacionId);

    if (!notificacion) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada.' });
    }

    
    notificacion.leida = true;
    await notificacion.save();

    console.log(`Notificación ${notificacionId} marcada como leída`);
    res.status(200).json({ success: true, message: 'Notificación marcada como leída.' });

  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/eliminar', async (req, res) => {
  console.log("Recibida solicitud para eliminar notificación:", req.body);

  const { notificacionId } = req.body;


  if (!notificacionId) {
    console.error("Faltan datos: notificacionId es requerido");
    return res.status(400).json({ success: false, message: 'El ID de la notificación es obligatorio.' });
  }

  try {
    
    const notificacion = await Notification.findById(notificacionId);

    if (!notificacion) {
      console.error("No se encontró la notificación en la base de datos.");
      return res.status(404).json({ success: false, message: 'Notificación no encontrada.' });
    }


    await Notification.findByIdAndDelete(notificacionId);
    
    console.log("Notificación eliminada correctamente.");
    res.status(200).json({ success: true, message: 'Notificación eliminada correctamente.' });

  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


module.exports = router;

