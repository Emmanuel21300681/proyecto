const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, match: /.+@gmail\.com/ },
  password: { type: String},
  dob: { type: Date},
  tipoUsuario: { type: String, enum: ["Deportista", "Apasionado"], default: null },
  favoriteSports: { type: [String], default: [] },
  favoriteAthletes: { type: [String], default: [] },
  verified: { type: Boolean, default: false }, 
  verificationCode: { type: String, default: null }, 
  mayoriaEdad: { type: Boolean, default: false },


  fotoPerfil: { type: String, default: '' },
  nombre: { type: String, default: null },
  genero: { type: String, enum: ["Masculino", "Femenino", "Prefiero no decirlo"], default: null },
  ubicacion: { type: String, default: null },
  biografia: { type: String, default: null },
  cuentaPrivada: { type: Boolean, default: false }, 
  bloqueados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],


  deporte: { type: String, default: null },
  nivel: { type: String, enum: ["Principiante", "Intermedio", "Avanzado", "Profesional"], default: null },
  logros: { type: String, default: null },
  amigos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  solicitudesPendientes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  solicitudesFechas: [{
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fecha: { type: Date, default: Date.now }
  }],


  publicaciones: [
    {
      id: { type: String, required: true }, 
      contenido: { type: String, required: true },
      imagen: { type: String }, 
      likes: { type: Number, default: 0 },
      likesBy: { type: [String], default: [] },
      comentarios: [
        {
          usuario: { type: String }, 
          contenido: { type: String },
          fecha: { type: Date, default: Date.now }, 
          fotoPerfil: { type: String } ,
        },
      ],
      fecha: { type: Date, default: Date.now }, 
    },
  ],
  sections: [
    {
      name: { type: String, required: true },
      color: { type: String, required: true },
    },
  ],
  eventosProgramados: [
    {
      idEventoCalendario: { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' },
      idEvento: { type: mongoose.Schema.Types.ObjectId, ref: 'Evento' },
      agregarCalendario: { type: Boolean, default: false }
    }
  ],
  misEventos: [
    {
      idEventoCalendario: { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' },
      idEvento: { type: mongoose.Schema.Types.ObjectId, ref: 'Evento' },
      agregarCalendario: { type: Boolean, default: false }
    }
  ],

  misLives: [
    {
      idLiveCalendario: { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' }, 
      idLive: { type: mongoose.Schema.Types.ObjectId, ref: 'Live' },
      agregarCalendario: { type: Boolean, default: false }
    }
  ],
  livesProgramados: [
    {
      idLiveCalendario: { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' }, 
      idLive: { type: mongoose.Schema.Types.ObjectId, ref: 'Live' },
      agregarCalendario: { type: Boolean, default: false }
    }
  ]

}, { timestamps: true });


module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
