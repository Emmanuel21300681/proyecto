const express = require("express");
const app = express(); 

const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const Live = require("../models/Live");
const Usuario = require("../models/User");
const Calendario = require("../models/calendar");

dotenv.config();


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
      enlace,
      fecha,
      hora,
      duracionValue,
      timeUnit,
      etiquetas,
      agregarCalendario,
      email,
      esInstantaneo,
    } = req.body;

    if (!nombre || !descripcion || !enlace || !fecha || !hora || !email || !timeUnit) {
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


    const nuevoLive = new Live({
      nombre,
      descripcion,
      enlace,
      fecha,
      hora,
      duracion: {
        value: timeUnit === "undefined" ? 0 : duracionValue || 0,
        unit: timeUnit,
      },
      etiquetas: etiquetas ? etiquetas.split(",") : [],
      imagen: imagenUrl,
      creadoPor: usuario._id,
      agregarCalendario,
      esInstantaneo,
    });

    await nuevoLive.save();

    let idLiveCalendario = undefined;

    if (agregarCalendario) {
      const eventoCalendario = {
        email: usuario.email,
        eventName: nombre,
        time: hora,
        location: "LIVE", 
        date: fecha,
        duration: {
          value: timeUnit === "undefined" ? 0 : duracionValue || 0, 
          unit: timeUnit,
        },
        type: "LIVE",
      };

      const response = await fetch("http://localhost:5000/api/calendario/agregar-evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventoCalendario),
      });

      const data = await response.json();
      if (data.success) {
        idLiveCalendario = data.event._id; 
      } else {
        console.warn("No se pudo agregar el LIVE al calendario:", data.message);
      }
    }


    usuario.misLives.push({
      idLiveCalendario, 
      idLive: nuevoLive._id,
      agregarCalendario,
    });

    usuario.livesProgramados.push({
      idLiveCalendario, 
      idLive: nuevoLive._id,
      agregarCalendario,
    });

    await usuario.save();

    return res.status(201).json({ success: true, message: "LIVE creado exitosamente.", live: nuevoLive });
  } catch (error) {
    console.error("Error al crear LIVE:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.get("/listar", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId es obligatorio." });
    }

    const lives = await Live.find().populate("creadoPor", "username fotoPerfil");
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }


    const livesConEstado = lives.map(live => {
      const estaAgregado = usuario.livesProgramados.some(
        l => l.idLive.toString() === live._id.toString()
      );

      return {
        ...live.toObject(),
        agregarCalendario: estaAgregado
      };
    });

    res.status(200).json({ success: true, lives: livesConEstado });
  } catch (error) {
    console.error("Error al listar LIVES:", error);
    res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.put("/modificar-live/:liveId", upload.single("imagen"), async (req, res) => {
  try {
    const { liveId } = req.params;
    const { nombre, descripcion, enlace, fecha, hora, etiquetas, "live-duration": duracionValue, "duration-unit": timeUnit } = req.body;

    console.log("Datos recibidos en backend:", { nombre, descripcion, enlace, fecha, hora, etiquetas, duracionValue, timeUnit });

    const live = await Live.findById(liveId);
    if (!live) {
      return res.status(404).json({ success: false, message: "LIVE no encontrado." });
    }

    if (nombre) live.nombre = nombre;
    if (descripcion) live.descripcion = descripcion;
    if (enlace) live.enlace = enlace;
    if (fecha) live.fecha = fecha;
    if (hora) live.hora = hora;
    if (etiquetas) {
      live.etiquetas = Array.isArray(etiquetas) ? etiquetas : etiquetas.split(",").map(e => e.trim());
    }
    if (duracionValue !== undefined && timeUnit) {
      live.duracion = { value: parseInt(duracionValue) || 0, unit: timeUnit };
    }

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

        live.imagen = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Error al subir la imagen:", uploadError);
        return res.status(500).json({ success: false, message: "Error al subir la imagen." });
      }
    }

    await live.save();

    console.log("LIVE actualizado en la base de datos:", live);

    return res.json({ success: true, message: "LIVE modificado correctamente." });
  } catch (error) {
    console.error("Error al modificar LIVE:", error);
    res.status(500).json({ success: false, message: "Error al modificar LIVE.", error: error.message });
  }
});

router.get("/mis-lives", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "El correo es obligatorio." });
    }

    const usuario = await Usuario.findOne({ email })
      .populate({
        path: "misLives.idLive",
        model: "Live"
      })
      .populate({
        path: "livesProgramados.idLive",
        model: "Live"
      });

    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    const misLives = usuario.misLives
      .filter(item => item.idLive)
      .map(item => ({
        ...item.idLive.toObject(),
        agregarCalendario: item.agregarCalendario,
        idLiveCalendario: item.idLiveCalendario ? item.idLiveCalendario.toString() : null, 
      }));


    const livesProgramados = usuario.livesProgramados
      .filter(item => item.idLive)
      .map(item => ({
        ...item.idLive.toObject(),
        agregarCalendario: item.agregarCalendario,
        idLiveCalendario: item.idLiveCalendario ? item.idLiveCalendario.toString() : null, 
      }));

    console.log("Respuesta de mis-lives enviada correctamente.");
    return res.status(200).json({ success: true, misLives, livesProgramados });
  } catch (error) {
    console.error("Error al obtener los Lives del usuario:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});



router.post("/agregar-live-calendario", async (req, res) => {
  try {
    const { userId, liveId, agregarCalendario } = req.body;

    if (!userId || !liveId) {
      return res.status(400).json({ success: false, message: "userId y liveId son obligatorios." });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    const live = await Live.findById(liveId);
    if (!live) {
      return res.status(404).json({ success: false, message: "LIVE no encontrado." });
    }

    const liveYaProgramado = usuario.livesProgramados.some(l => l.idLive.toString() === liveId);
    if (liveYaProgramado) {
      return res.status(400).json({ success: false, message: "El LIVE ya está en lives programados." });
    }

    let idLiveCalendario = undefined;;

    if (agregarCalendario) {
      const eventoCalendario = {
        email: usuario.email,
        eventName: live.nombre,
        time: live.hora,
        location: "LIVE",
        date: live.fecha,
        duration: {
          value: live.duracion?.value || 0,
          unit: live.duracion?.unit || "hours", 
        },
        type: "LIVE",
      };

      const response = await fetch("http://localhost:5000/api/calendario/agregar-evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventoCalendario),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("Error al guardar el LIVE en el calendario:", data.message);
        return res.status(500).json({ success: false, message: "Error al guardar el LIVE en el calendario." });
      }

      idLiveCalendario = data.event._id;
    }

    usuario.livesProgramados.push({
      idLiveCalendario,
      idLive: liveId,
      agregarCalendario,
    });

    await usuario.save();

    return res.status(200).json({ success: true, message: "LIVE agregado a lives programados correctamente." });
  } catch (error) {
    console.error("Error al agregar LIVE a lives programados:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.post("/eliminar-live-calendario", async (req, res) => {
  try {
    const { userId, liveId, idLiveCalendario } = req.body;

    console.log("Datos recibidos para eliminar live del calendario:", { userId, liveId, idLiveCalendario });

    if (!userId || !idLiveCalendario || idLiveCalendario === "null" || idLiveCalendario.trim() === "") {
      return res.status(400).json({ success: false, message: "userId y idLiveCalendario son obligatorios." });
    }

    await Calendario.findByIdAndDelete(idLiveCalendario);

    return res.status(200).json({ success: true, message: "Evento eliminado del calendario correctamente." });
  } catch (error) {
    console.error("Error al eliminar evento del calendario:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.delete("/eliminar-live", async (req, res) => {
  try {
    const { userId, liveId } = req.body;

    console.log("Datos recibidos para eliminar live:", { userId, liveId });


    if (!userId || !liveId) {
      return res.status(400).json({ success: false, message: "userId y liveId son obligatorios." });
    }


    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    usuario.misLives = usuario.misLives.filter(l => l.idLive.toString() !== liveId);
    usuario.livesProgramados = usuario.livesProgramados.filter(l => l.idLive.toString() !== liveId);

    await usuario.save();

    await Live.findByIdAndDelete(liveId);

    return res.status(200).json({ success: true, message: "LIVE eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar LIVE:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

router.delete("/eliminar-live-programado", async (req, res) => {
  console.log("Solicitud DELETE recibida en /eliminar-live-programado");
  try {
    const { userId, liveId } = req.body;
    console.log("Datos recibidos:", { userId, liveId });

    if (!userId || !liveId) {
      return res.status(400).json({ success: false, message: "userId y liveId son obligatorios." });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    const liveProgramado = usuario.livesProgramados.find(l => l.idLive.toString() === liveId);
    if (!liveProgramado) {
      return res.status(404).json({ success: false, message: "Live no encontrado en livesProgramados." });
    }

    usuario.livesProgramados = usuario.livesProgramados.filter(l => l.idLive.toString() !== liveId);

    if (liveProgramado.idLiveCalendario) {
      await Calendario.findByIdAndDelete(liveProgramado.idLiveCalendario);
    }

    await usuario.save();

    return res.status(200).json({ success: true, message: "Live eliminado de livesProgramados correctamente." });
  } catch (error) {
    console.error("Error al eliminar live de livesProgramados:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.get("/obtener-live/:liveId", async (req, res) => {
  try {
    const { liveId } = req.params;
    const live = await Live.findById(liveId);

    if (!live) {
      return res.status(404).json({ success: false, message: "LIVE no encontrado." });
    }

    return res.status(200).json({ success: true, live });
  } catch (error) {
    console.error("Error al obtener LIVE:", error);
    return res.status(500).json({ success: false, message: "Error del servidor." });
  }
});

module.exports = router;