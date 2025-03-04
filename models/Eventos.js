const mongoose = require("mongoose");

const ResenaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
  contenido: { type: String, required: true }, 
  fecha: { type: Date, default: Date.now }, 
});

const CalificacionSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
  calificacion: { type: Number, required: true, min: 1, max: 5 }, 
  fecha: { type: Date, default: Date.now }, 
});

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
  calificaciones: [CalificacionSchema], 
  resenas: [ResenaSchema], 
}, { timestamps: true });

const Event = mongoose.model("Eventos", EventoSchema);
module.exports = { Event };