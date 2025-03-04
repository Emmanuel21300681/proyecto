const mongoose = require("mongoose");

const LiveSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true }, 
  enlace: { type: String, required: true }, 
  fecha: { type: String, required: true }, 
  hora: { type: String, required: true }, 
  duracion: {
    value: { type: Number, default: 0 }, 
    unit: { type: String, enum: ["hours", "minutes", "undefined"], default: "hours" }, 
  },
  etiquetas: { type: [String], default: [] }, 
  imagen: { type: String, default: "" },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
  agregarCalendario: { type: Boolean, default: false }, 
  esInstantaneo: { type: Boolean, default: false },
}, { timestamps: true });

const Live = mongoose.model("Live", LiveSchema);
module.exports = Live;