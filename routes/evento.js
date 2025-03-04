const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const Calendar = require('../models/calendar'); 
const Usuario = require('../models/User');
const { Event } = require('../models/Eventos');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const EventoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  ubicacion: { type: String, required: true },
  costo: { type: String, required: true },
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  duracion: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['hours', 'minutes', 'undefined'], required: true },
  },
  etiquetas: { type: [String], default: [] },
  agregarCalendario: { type: Boolean, default: false },
  imagen: { type: String, default: "" },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const Evento = mongoose.model("Evento", EventoSchema);

router.post('/obtener-userId-por-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "El correo es obligatorio." });
    }

    const usuario = await mongoose.model("User").findOne({ email });

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    return res.status(200).json({
      success: true,
      userId: usuario._id,
      username: usuario.username,  
      fotoPerfil: usuario.fotoPerfil || "img/perfil.jpg"  
    });

  } catch (error) {
    console.error("Error al obtener userId por correo:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.post("/crear", upload.single("imagen"), async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      ubicacion,
      costo,
      fecha,
      hora,
      duracionValue,
      duracionUnit,
      etiquetas,
      agregarCalendario,
      email,
    } = req.body;

    if (!nombre || !descripcion || !ubicacion || !costo || !fecha || !hora || !duracionUnit || !email) {
      return res.status(400).json({ success: false, message: "Todos los campos son obligatorios." });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    let imagenUrl = "";
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "image" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        imagenUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ success: false, message: "Error al subir la imagen." });
      }
    }

    const nuevoEvento = new Evento({
      nombre,
      descripcion,
      ubicacion,
      costo,
      fecha,
      hora,
      duracion: {
        value: duracionUnit !== "undefined" ? parseInt(duracionValue, 10) : 0,
        unit: duracionUnit,
      },
      etiquetas: etiquetas ? etiquetas.split(",") : [],
      agregarCalendario,
      creadoPor: usuario._id,
      imagen: imagenUrl,
    });

    await nuevoEvento.save();

    let idEventoCalendario = null;

    if (agregarCalendario) {
      const eventoExistente = await Calendar.findOne({
        user: usuario._id,
        eventName: nombre,
        date: fecha,
      });

      if (eventoExistente) {
        console.log("Evento ya existente en el calendario. No se agregará de nuevo.");
        idEventoCalendario = eventoExistente._id;
      } else {
        console.log("Agregando evento al calendario...");

        const eventoCalendario = {
          email: usuario.email,
          eventName: nombre,
          time: hora,
          location: ubicacion,
          date: fecha,
          duration: {
            value: duracionUnit !== "undefined" ? parseInt(duracionValue, 10) : 0,
            unit: duracionUnit,
          },
          type: "EVENTO",
        };

        try {
          const response = await fetch("http://localhost:5000/api/calendario/agregar-evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventoCalendario),
          });

          const data = await response.json();

          if (data.success) {
            idEventoCalendario = data.event._id;
          } else {
            console.warn("No se pudo agregar el evento al calendario:", data.message);
          }
        } catch (error) {
          console.error("Error al agregar evento al calendario:", error);
        }
      }
    }

    usuario.misEventos.push({
      idEvento: nuevoEvento._id,
      idEventoCalendario: idEventoCalendario,
      agregarCalendario,
    });
    usuario. eventosProgramados.push({
      idEvento: nuevoEvento._id,
      idEventoCalendario: idEventoCalendario,
      agregarCalendario,
    });

    await usuario.save();

    return res.status(201).json({ success: true, message: "Evento creado exitosamente." });
  } catch (error) {
    console.error("Error al crear evento:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.get('/listar', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId es obligatorio." });
    }

    const eventos = await Evento.find(); 
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    
    const eventosConEstado = eventos.map(evento => {
      const estaAgregado = usuario.eventosProgramados.some(
        e => e.idEvento.toString() === evento._id.toString()
      );

      return {
        ...evento.toObject(),
        agregarCalendario: estaAgregado
      };
    });

    res.status(200).json({ success: true, eventos: eventosConEstado });
  } catch (error) {
    console.error("Error al listar eventos:", error);
    res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.get('/evento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const evento = await Evento.findById(id);

    if (!evento) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }

    return res.status(200).json({ success: true, evento });
  } catch (error) {
    console.error("Error al obtener el evento:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.post('/agregar-evento-calendario', async (req, res) => {
  try {
    const { userId, eventoId, agregarCalendario } = req.body;

    console.log("Datos recibidos:", req.body);

    if (!userId || !eventoId) {
      return res.status(400).json({ success: false, message: "userId y eventoId son obligatorios." });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) {
      return res.status(404).json({ success: false, message: " Evento no encontrado." });
    }


    const eventoYaProgramado = usuario.eventosProgramados.some(e => e.idEvento.toString() === eventoId);

    if (eventoYaProgramado) {
      return res.status(400).json({ success: false, message: "El evento ya está en eventos programados." });
    }

    let idEventoCalendario = null;

    if (evento.creadoPor.toString() === userId) {
      console.log("👤 El usuario es el creador del evento. Solo se añadirá a eventosProgramados.");
      idEventoCalendario = evento.idEventoCalendario || null;
    } else {

      if (agregarCalendario) {
        console.log("Agregando evento al calendario para un usuario distinto al creador...");

        const eventoCalendario = {
          email: usuario.email,
          eventName: evento.nombre,
          time: evento.hora,
          location: evento.ubicacion,
          date: evento.fecha,
          duration: {
            value: evento.duracion?.value || 0,
            unit: evento.duracion?.unit || "undefined",
          },
          type: "EVENTO",
        };

        const response = await fetch("http://localhost:5000/api/calendario/agregar-evento", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventoCalendario)
        });

        const data = await response.json();

        if (!data.success) {
          console.error(" Error al guardar el evento en el calendario:", data.message);
          return res.status(500).json({ success: false, message: "Error al guardar el evento en el calendario." });
        }

        idEventoCalendario = data.event._id; 
      }
    }

    usuario.eventosProgramados.push({ idEvento: eventoId, idEventoCalendario: idEventoCalendario, agregarCalendario });
    await usuario.save();

    return res.status(200).json({ success: true, message: "🎉 Evento agregado a eventos programados correctamente." });

  } catch (error) {
    console.error(" Error al agregar evento a eventos programados:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.get('/mis-eventos', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "El correo es obligatorio." });
    }

    console.log("Buscando usuario con email:", email);

    const usuario = await Usuario.findOne({ email })
      .populate({
        path: 'misEventos.idEvento',
        model: 'Evento'
      })
      .populate({
        path: 'eventosProgramados.idEvento',
        model: 'Evento'
      });

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    console.log("Usuario encontrado:", usuario);

    const misEventos = usuario.misEventos
      .filter(item => item.idEvento)
      .map(item => ({
        ...item.idEvento.toObject(),
        agregarCalendario: item.agregarCalendario,
        idEventoCalendario: item.idEventoCalendario 
      }));

    const eventosProgramados = usuario.eventosProgramados
      .filter(item => item.idEvento)
      .map(item => ({
        ...item.idEvento.toObject(),
        agregarCalendario: item.agregarCalendario,
        idEventoCalendario: item.idEventoCalendario 
      }));

    console.log("Mis Eventos:", misEventos);
    console.log("Eventos Programados:", eventosProgramados);

    return res.status(200).json({ success: true, misEventos, eventosProgramados });
  } catch (error) {
    console.error("Error al obtener los eventos del usuario:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.post('/eliminar-evento-calendario', async (req, res) => {
  try {
    const { userId, eventoId, idEventoCalendario } = req.body;

    console.log("Datos recibidos para eliminar evento del calendario:", req.body);

    if (!userId || !eventoId) {
      return res.status(400).json({ success: false, message: "userId y eventoId son obligatorios." });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: " Usuario no encontrado." });
    }

    const eventoEnProgramados = usuario.eventosProgramados.find(e => e.idEvento.toString() === eventoId);
    let idCalendario = idEventoCalendario || (eventoEnProgramados ? eventoEnProgramados.idEventoCalendario : null);

    if (!idCalendario) {
      console.warn("No se encontró idEventoCalendario en eventosProgramados.");
    }

    usuario.eventosProgramados = usuario.eventosProgramados.filter(e => e.idEvento.toString() !== eventoId);
    await usuario.save();

    if (idCalendario) {
      console.log(`🗑 Eliminando evento del calendario con idEventoCalendario: ${idCalendario}`);
      const response = await fetch(`http://localhost:5000/api/calendario/eliminar-evento/${idCalendario}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      const data = await response.json();
      if (!data.success) {
        console.error("Error al eliminar evento del calendario:", data.message);
        return res.status(500).json({ success: false, message: "Error al eliminar evento del calendario." });
      }
    }

    return res.status(200).json({ success: true, message: "Evento eliminado de eventosProgramados y del calendario." });

  } catch (error) {
    console.error("Error al eliminar evento del calendario:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});




router.put('/modificar/:id', upload.single("imagen"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      ubicacion,
      costo,
      fecha,
      hora,
      duracionValue,
      duracionUnit,
      etiquetas,
      agregarCalendario
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "El ID del evento es obligatorio." });
    }

    let evento = await Evento.findById(id);
    if (!evento) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }

    let imagenUrl = evento.imagen; 
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "image" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        imagenUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ success: false, message: "Error al subir la imagen." });
      }
    }

    evento.nombre = nombre || evento.nombre;
    evento.descripcion = descripcion || evento.descripcion;
    evento.ubicacion = ubicacion || evento.ubicacion;
    evento.costo = costo || evento.costo;
    evento.fecha = fecha || evento.fecha;
    evento.hora = hora || evento.hora;
    evento.duracion = {
      value: duracionValue ? parseInt(duracionValue) : evento.duracion.value,
      unit: duracionUnit || evento.duracion.unit
    };
    evento.etiquetas = etiquetas ? etiquetas.split(",") : evento.etiquetas;
    evento.agregarCalendario = agregarCalendario !== undefined ? agregarCalendario : evento.agregarCalendario;
    evento.imagen = imagenUrl;

    await evento.save();

    return res.status(200).json({ success: true, message: "Evento modificado exitosamente.", evento });
  } catch (error) {
    console.error("Error al modificar evento:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});





router.delete('/eliminar-evento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedEvent = await Evento.findByIdAndDelete(id);
    if (!deletedEvent) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }

    await Usuario.updateMany(
      { $or: [{ "misEventos.idEvento": id }, { "eventosProgramados.idEvento": id }] },
      { $pull: { misEventos: { idEvento: id }, eventosProgramados: { idEvento: id } } }
    );

    const response = await fetch(`http://localhost:5000/api/calendario/eliminar-evento/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!data.success) {
      console.warn("El evento se eliminó, pero hubo un problema con el calendario:", data.message);
    }

    return res.status(200).json({ success: true, message: "Evento eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.get('/resenas/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

 
    const evento = await Event.findById(eventId).populate({
      path: "resenas.usuario",
      select: "username fotoPerfil" 
    });

    if (!evento) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }

    return res.status(200).json({ success: true, resenas: evento.resenas });
  } catch (error) {
    console.error("Error al obtener las reseñas:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.post('/agregar-resena', async (req, res) => {
  try {
    const { userId, eventId, contenido } = req.body;

    if (!userId || !eventId || !contenido) {
      return res.status(400).json({ success: false, message: "Todos los campos son obligatorios." });
    }

    const evento = await Event.findById(eventId);
    if (!evento) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }


    const nuevaResena = {
      usuario: userId,
      contenido: contenido,
      fecha: new Date(), 
    };

    evento.resenas.push(nuevaResena);
    await evento.save();

    return res.status(201).json({ success: true, resena: nuevaResena });
  } catch (error) {
    console.error("Error al agregar la reseña:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.post('/calificar', async (req, res) => {
  try {
    const { userId, eventId, calificacion } = req.body;


    if (!userId || !eventId || !calificacion) {
      return res.status(400).json({ success: false, message: "Todos los campos son obligatorios." });
    }

    if (calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ success: false, message: "La calificación debe estar entre 1 y 5." });
    }


    const evento = await Event.findById(eventId);
    if (!evento) {
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }


    const nuevaCalificacion = {
      usuario: userId,
      calificacion: calificacion,
      fecha: new Date(), 
    };

    evento.calificaciones.push(nuevaCalificacion);
    await evento.save();

    return res.status(200).json({ success: true, calificacion: nuevaCalificacion });
  } catch (error) {
    console.error("Error al calificar el evento:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


module.exports = router;




