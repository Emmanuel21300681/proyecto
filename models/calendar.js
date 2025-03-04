const mongoose = require('mongoose');
const Usuario = require('../models/User');

const CalendarSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', 
    required: true,
  },
  eventName: {
    type: String,
    required: true,
  },
  days: {
    lunes: { type: Boolean, default: false },
    martes: { type: Boolean, default: false },
    miercoles: { type: Boolean, default: false },
    jueves: { type: Boolean, default: false },
    viernes: { type: Boolean, default: false },
    sabado: { type: Boolean, default: false },
    domingo: { type: Boolean, default: false },
  },
  time: {
    type: String, 
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: function () {
      
      return this.type !== "Entrenamiento";
    },
  },
  duration: {
    value: { type: Number, required: true }, 
    unit: { type: String, enum: ['hours', 'minutes', 'undefined'], required: true }, 
  },
  type: {
    type: String,
    required: true,
    validate: {
      validator: async function (value) {
        const user = await Usuario.findById(this.user, 'sections');
        if (!user) {
          throw new Error('Usuario no encontrado.');
        }

        const sectionNames = user.sections.map((section) => section.name.toUpperCase());
        const validTypes = ['LIVE', 'ENTRENAMIENTO', 'CITA MÉDICA', 'EVENTO', 'COMPETENCIA', ...sectionNames];
        return validTypes.includes(value.toUpperCase());
      },
      message: (props) => `${props.value} no es un tipo válido.`,
    },
  },
  
}, { timestamps: true });

module.exports = mongoose.model('Calendar', CalendarSchema);

