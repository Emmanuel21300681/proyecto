const express = require('express');
const router = express.Router();
const Calendar = require('../models/calendar');
const Usuario = require('../models/User');


router.post('/agregar-evento', async (req, res) => {
  try {
    const { email, eventName, days, time, location, date, duration, type } = req.body;

    if (!email || !eventName || !time || !location || !type) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben ser completados.',
      });
    }

    const user = await Usuario.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const newEvent = new Calendar({
      user: user._id,
      eventName,
      days: days || {},
      time,
      location,
      date: type === "Entrenamiento" ? null : date,
      duration: {
        value: duration.unit !== 'undefined' ? duration.value : 0,
        unit: duration.unit,
      },
      type,
    });

    await newEvent.save();
    res.status(201).json({ success: true, message: 'Evento agregado correctamente.', event: newEvent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al agregar el evento.', error });
  }
});



router.delete('/eliminar-evento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Eliminando evento del calendario con ID:", id); 

    const deletedEvent = await Calendar.findByIdAndDelete(id);
    if (!deletedEvent) {
      console.error("Evento no encontrado en el calendario.");
      return res.status(404).json({ success: false, message: "Evento no encontrado." });
    }

    console.log("Evento eliminado del calendario:", deletedEvent); 
    res.status(200).json({ success: true, message: 'Evento eliminado correctamente.' });
  } catch (error) {
    console.error("Error al eliminar evento del calendario:", error);
    res.status(500).json({ success: false, message: 'Error al eliminar el evento.' });
  }
});



router.post('/obtener-eventos', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Usuario.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const events = await Calendar.find({ user: user._id });

    const sanitizedEvents = events.map((event) => {
      if (event.type === "Entrenamiento") {
        event.date = null; 
      }
      return event;
    });

    res.status(200).json({
      success: true,
      events: sanitizedEvents,
    });
  } catch (error) {
    console.error("Error al obtener eventos:", error);
    res.status(500).json({ success: false, message: 'Error al obtener eventos.', error });
  }
});



router.put('/modificar-evento', async (req, res) => {
  try {
    const { eventId, eventName, days, date, time, location, duration, type } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'ID del evento no proporcionado.' });
    }

    
    const isRecurring = Object.values(days || {}).some((day) => day === true);
    if (!date && !isRecurring) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una fecha o seleccionar al menos un día recurrente.',
      });
    }

   
    const defaultDays = {
      lunes: false,
      martes: false,
      miercoles: false,
      jueves: false,
      viernes: false,
      sabado: false,
      domingo: false,
    };
    const sanitizedDays = { ...defaultDays, ...days };

   
    const sanitizedDate = type === "Entrenamiento" ? null : date;

    
    const updatedEvent = await Calendar.findByIdAndUpdate(
      eventId,
      {
        eventName,
        days: sanitizedDays,
        date: sanitizedDate,
        time,
        location,
        duration,
        type,
      },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado.' });
    }

    res.status(200).json({
      success: true,
      message: 'Evento modificado correctamente.',
      event: updatedEvent,
    });
  } catch (error) {
    console.error('Error al modificar el evento:', error);
    res.status(500).json({ success: false, message: 'Error al modificar el evento.', error });
  }
});




router.post('/agregar-seccion', async (req, res) => {
  const { email, name, color } = req.body;

  if (!email || !name || !color) {
    return res.status(400).json({
      success: false,
      message: 'El correo, el nombre y el color son obligatorios.',
    });
  }

  try {
    console.log('Buscando usuario con correo:', email);

    
    const user = await Usuario.findOne({ email });
    console.log('Usuario encontrado:', user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    
    if (!Array.isArray(user.sections)) {
      console.error('El campo sections no es un arreglo o no está definido.');
      return res.status(500).json({
        success: false,
        message: 'Error interno: El campo sections no está configurado correctamente.',
      });
    }

    
    console.log('Agregando sección:', { name, color });
    user.sections.push({ name, color });
    await user.save();
    console.log('Sección guardada exitosamente.');

    res.status(201).json({
      success: true,
      message: 'Sección agregada correctamente.',
      section: { name, color },
    });
  } catch (error) {
    console.error('Error al agregar la sección:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al agregar la sección.',
    });
  }
});


router.post('/obtener-secciones', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await Usuario.findOne({ email }, 'sections');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    res.status(200).json({ success: true, sections: user.sections });
  } catch (error) {
    console.error('Error al obtener las secciones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener las secciones.' });
  }
});

router.delete('/eliminar-seccion/:name', async (req, res) => {
  const { name } = req.params;

  if (!name || name === "undefined") {
    return res.status(400).json({ success: false, message: 'Nombre de sección no proporcionado o inválido.' });
  }

  try {
    
    const user = await Usuario.findOne({ 'sections.name': name });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Sección no encontrada.' });
    }

    
    user.sections = user.sections.filter((section) => section.name !== name);
    await user.save();

    res.status(200).json({ success: true, message: 'Sección eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la sección:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la sección.' });
  }
});



module.exports = router;