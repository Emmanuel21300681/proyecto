const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');  
const OcasionalUser = require('../models/Ocasional');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); 
const { OAuth2Client } = require('google-auth-library'); 
const CLIENT_ID = '401811793922-seivcfldttv837uj4dma9fp4s76fssmg.apps.googleusercontent.com'; 
const client = new OAuth2Client(CLIENT_ID); 
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const mongoose = require('mongoose');




cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Error con Nodemailer:", error);
  } else {
    console.log("✅ Servidor de correo listo.");
  }
});


router.post('/registro', async (req, res) => {
  const { username, email, password, dob } = req.body;

  
  if (!username || !email || !password || !dob) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
  }

  try {
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
      }

      
      const fechaNacimiento = new Date(dob);
      const hoy = new Date();
      const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
      const mes = hoy.getMonth() - fechaNacimiento.getMonth();
      const dia = hoy.getDate() - fechaNacimiento.getDate();

      const mayoriaEdad = edad > 18 || (edad === 18 && (mes > 0 || (mes === 0 && dia >= 0)));
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

      
      const newUser = new User({
          username,
          email,
          password: hashedPassword,
          dob: fechaNacimiento,
          mayoriaEdad, 
          verificationCode,
      });

      await newUser.save();

      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Código de verificación - AthleticXs',
          text: `Hola ${username}, tu código de verificación es: ${verificationCode}.`,
      };

      await transporter.sendMail(mailOptions);

      res.status(201).json({
          success: true,
          message: 'Usuario registrado exitosamente. Verifica tu correo.',
          email: newUser.email,
          username: newUser.username,
          dob: newUser.dob.toISOString().split('T')[0],
          mayoriaEdad: newUser.mayoriaEdad, 
      });
  } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/reenviar-codigo', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }


    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = newCode;
    await user.save();


    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Nuevo Código de Verificación - AthleticXs',
      text: `Hola, tu nuevo código de verificación es: ${newCode}.`,
    };


    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error al enviar el correo:', error);
        return res.status(500).json({ success: false, message: 'Error al enviar el código.' });
      }
      console.log(`Código enviado a: ${email} | ID: ${info.messageId}`);
      res.status(200).json({ success: true, message: 'El código de verificación se ha enviado nuevamente.' });
    });

  } catch (err) {
    console.error('Error al reenviar el código:', err);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
  }

  try {
    
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Contraseña incorrecta.' });
    }

    
    const isRegistrationComplete =
      user.tipoUsuario !== null &&
      Array.isArray(user.favoriteSports) &&
      user.favoriteSports.length > 0 &&
      Array.isArray(user.favoriteAthletes) &&
      user.favoriteAthletes.length > 0;

    
    res.status(200).json({
      success: true,
      completado: isRegistrationComplete, 
      email: user.email, 
      username: user.username, 
      dob: user.dob.toISOString().split('T')[0], 
    });
  } catch (err) {
    console.error('Error en el login:', err);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/obtener-correo', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'El usuario/correo es obligatorio.' });
  }

  try {
    
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    res.status(200).json({ success: true, email: user.email });
  } catch (error) {
    console.error('Error al obtener el correo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/verificar-codigo', async (req, res) => {
  const { email, code } = req.body;

  console.log('Email recibido:', email);
  console.log('Código recibido:', code);

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Correo y código son obligatorios.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.verificationCode === code) {
      user.verified = true;
      user.verificationCode = null; 
      await user.save();
      return res.status(200).json({ success: true, message: 'Código verificado correctamente.' });
    } else {
      return res.status(400).json({ success: false, message: 'Código incorrecto.' });
    }
  } catch (err) {
    console.error('Error al verificar el código:', err);
    return res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/restablecer-contrase%C3%B1a', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'El correo no está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Contraseña actualizada exitosamente.' });
  } catch (err) {
    console.error('Error interno:', err.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

router.post('/setRole', async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    user.tipoUsuario = role;
    await user.save();

    res.status(200).json({ success: true, message: 'Rol asignado correctamente.' });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/savePreferences', async (req, res) => {
  const { email, favoriteSports, favoriteAthletes } = req.body;

  if (!email || !Array.isArray(favoriteSports) || !Array.isArray(favoriteAthletes)) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    user.favoriteSports = favoriteSports;
    user.favoriteAthletes = favoriteAthletes;
    await user.save();

    res.status(200).json({ success: true, message: 'Preferencias guardadas exitosamente.' });
  } catch (error) {
    console.error('Error al guardar preferencias:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token es obligatorio.' });
    }

    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    console.log("Token verificado, payload:", payload);

    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'El correo no está registrado.' });
    }

    
    const isProfileComplete = 
      !!user.tipoUsuario && 
      Array.isArray(user.favoriteSports) && user.favoriteSports.length > 0 && 
      Array.isArray(user.favoriteAthletes) && user.favoriteAthletes.length > 0; 

    console.log(`Perfil completo: ${isProfileComplete}`);

    return res.json({ success: true, completado: isProfileComplete });
  } catch (error) {
    console.error('Error en Google Login:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});


router.post('/google-register', async (req, res) => {
  console.log("Cuerpo de la solicitud:", req.body); 
  const { token } = req.body;

  if (!token) {
      return res.status(400).json({ success: false, message: 'Token no proporcionado.' });
  }

  try {
      const ticket = await client.verifyIdToken({
          idToken: token,
          audience: '401811793922-seivcfldttv837uj4dma9fp4s76fssmg.apps.googleusercontent.com',
      });

      const payload = ticket.getPayload();
      console.log("Payload del token:", payload); 

      const email = payload.email;
      const username = payload.name;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
      }

      const newUser = new User({
          username,
          email,
          verified: true, 
      });

      await newUser.save();

      res.status(201).json({
          success: true,
          message: 'Usuario registrado exitosamente con Google.',
          email: newUser.email,
          username: newUser.username,
      });
  } catch (err) {
      console.error('Error en el registro con Google:', err);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/registro-ocasional', async (req, res) => {
  const { mayoriaEdad } = req.body;

  if (mayoriaEdad === undefined) {
      return res.status(400).json({ success: false, message: 'El campo mayoriaEdad es obligatorio.' });
  }

  try {
      
      const newOcasionalUser = new OcasionalUser({
          mayoriaEdad,
      });

      await newOcasionalUser.save();

      res.status(201).json({
          success: true,
          message: 'Usuario ocasional registrado exitosamente.',
          id: newOcasionalUser._id, 
          mayoriaEdad: newOcasionalUser.mayoriaEdad,
      });
  } catch (err) {
      console.error('Error al registrar usuario ocasional:', err);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.get('/perfil/check', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email es requerido' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const isDeportista = user.tipoUsuario === "Deportista";
    const camposFaltantes = [];

    if (!user.nombre) camposFaltantes.push("nombre");
    if (!user.genero) camposFaltantes.push("genero");
    if (!user.ubicacion) camposFaltantes.push("ubicacion");
    if (!user.biografia) camposFaltantes.push("biografia");
    if (isDeportista) {
      if (!user.deporte) camposFaltantes.push("deporte");
      if (!user.nivel) camposFaltantes.push("nivel");
    }

    if (camposFaltantes.length > 0) {
      return res.status(200).json({ success: true, completo: false, camposFaltantes });
    }

    res.status(200).json({ success: true, completo: true });
  } catch (error) {
    console.error('Error al verificar el perfil:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});



router.post('/perfil', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Correo no proporcionado.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const perfilCompleto =
      user.nombre &&
      user.genero &&
      user.ubicacion &&
      (user.tipoUsuario === 'Deportista'
        ? user.deporte && user.nivel && user.logros
        : true); 

    res.status(200).json({
      success: true,
      perfilCompleto,
      tipoUsuario: user.tipoUsuario,
    });
  } catch (error) {
    console.error('Error al verificar perfil:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/guardar', async (req, res) => {
  const { email, fotoPerfil, nombre, deporte, nivel, genero, ubicacion, logros, biografia, cuentaPrivada } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    
    if (fotoPerfil) {
      try {
        const uploadResult = await cloudinary.uploader.upload(fotoPerfil, {
          folder: "profiles", 
        });
        user.fotoPerfil = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Error al subir la imagen a Cloudinary:', uploadError);
        return res.status(500).json({ success: false, message: 'Error al subir la imagen' });
      }
    }

    
    user.nombre = nombre || user.nombre;
    user.genero = genero || user.genero;
    user.ubicacion = ubicacion || user.ubicacion;
    user.biografia = biografia || user.biografia;
    user.cuentaPrivada = cuentaPrivada;

    if (user.tipoUsuario === "Deportista") {
      user.deporte = deporte || user.deporte;
      user.nivel = nivel || user.nivel;
      user.logros = logros || user.logros;
    }

    
    user.perfilCompleto = user.tipoUsuario === "Deportista"
      ? user.nombre && user.deporte && user.nivel && user.genero && user.ubicacion && user.logros && user.biografia
      : user.nombre && user.genero && user.ubicacion && user.biografia;

    await user.save();
    res.status(200).json({ success: true, message: 'Perfil actualizado correctamente.' });
  } catch (error) {
    console.error('Error al guardar el perfil:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/perfil/estado', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El email es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const perfilCompleto = user.tipoUsuario === "Deportista"
      ? user.nombre && user.deporte && user.nivel && user.genero && user.ubicacion && user.logros && user.biografia
      : user.nombre && user.genero && user.ubicacion && user.biografia;

    res.status(200).json({
      success: true,
      perfilCompleto: !!perfilCompleto,
      tipoUsuario: user.tipoUsuario,
    });
  } catch (error) {
    console.error("Error al verificar el estado del perfil:", error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/perfil/datos', async (req, res) => {
  console.log('Solicitud recibida en /perfil/datos');
  console.log('Body:', req.body);

  const { email } = req.body;

  if (!email) {
    console.error('Falta el campo email');
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });
    console.log('Usuario encontrado:', user);

    if (!user) {
      console.error('Usuario no encontrado');
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

  

    res.status(200).json({
      success: true,
      fotoPerfil: user.fotoPerfil,
      username: user.username,
      dob: user.dob,
      tipoUsuario: user.tipoUsuario,
      deporte: user.deporte,
      nivel: user.nivel,
      logros: user.logros,
      biografia: user.biografia,
      nombre: user.nombre, 
      genero: user.genero, 
      ubicacion: user.ubicacion, 
      contenido: user.publicaciones,
      cuentaPrivada: user.cuentaPrivada,
      publicaciones: user.publicaciones,
      
      
    });
    
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/actualizar', async (req, res) => {
  const { email, username, nombre, genero, ubicacion, biografia, cuentaPrivada, fotoPerfil } = req.body;

  try {
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    
    user.username = username;
    user.nombre = nombre;
    user.genero = genero;
    user.ubicacion = ubicacion;
    user.biografia = biografia;
    user.cuentaPrivada = cuentaPrivada;
    user.fotoPerfil = fotoPerfil;

    
    await user.save();

    res.status(200).json({ success: true, message: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    res.status(500).json({ success: false, message: 'Error al actualizar el perfil' });
  }
});


router.post('/perfil/agregar-publicacion', async (req, res) => {
  const { email, contenido, imagen } = req.body;

  if (!email || !contenido) {
    return res.status(400).json({ success: false, message: 'El email y el contenido son obligatorios.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    let imagenURL = '';
    if (imagen) {
      try {
        const uploadResult = await cloudinary.uploader.upload(imagen, {
          folder: "publications",
        });
        imagenURL = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Error al subir la imagen de la publicación a Cloudinary:', uploadError);
        return res.status(500).json({ success: false, message: 'Error al subir la imagen' });
      }
    }

    
    const nuevaPublicacion = {
      id: Date.now().toString(),
      contenido,
      imagen: imagenURL,
    };

    user.publicaciones.push(nuevaPublicacion);
    await user.save();

    res.status(200).json({ success: true, message: 'Publicación agregada con éxito.', publicacion: nuevaPublicacion });
  } catch (error) {
    console.error('Error al agregar publicación:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/perfil/obtener-publicaciones', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El email es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    res.status(200).json({ success: true, publicaciones: user.publicaciones });
  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.delete('/post/eliminar', async (req, res) => {
  const { email, postId } = req.body; 

  if (!email || !postId) {
    return res.status(400).json({ success: false, message: 'El correo y el ID de la publicación son obligatorios.' });
  }

  try {
    
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    
    const publicacionesActualizadas = user.publicaciones.filter((pub) => pub.id !== postId);

    
    if (publicacionesActualizadas.length === user.publicaciones.length) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    
    user.publicaciones = publicacionesActualizadas;
    await user.save();

    res.status(200).json({ success: true, message: 'Publicación eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la publicación:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.put('/post/actualizar', async (req, res) => {
  const { postId, likes, comments } = req.body;

  if (!postId) {
    return res.status(400).json({ success: false, message: 'El ID de la publicación es obligatorio.' });
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    if (likes !== undefined) post.likes = likes;
    if (comments) post.comments = comments;

    await post.save();

    res.status(200).json({ success: true, message: 'Publicación actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar la publicación:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/post/like', async (req, res) => {
  const { email, postId } = req.body;

  if (!email || !postId) {
      return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
      
      const usuarioPublicador = await User.findOne({ "publicaciones.id": postId });

      if (!usuarioPublicador) {
          return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
      }

      
      const post = usuarioPublicador.publicaciones.find(p => p.id === postId);

      if (!post) {
          return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
      }

      
      if (!post.likesBy) post.likesBy = [];
      const likedIndex = post.likesBy.indexOf(email);

      if (likedIndex >= 0) {
          post.likesBy.splice(likedIndex, 1);
          post.likes--;
      } else {
          post.likesBy.push(email);
          post.likes++;
      }

      await usuarioPublicador.save();

      
      const io = req.app.get('io');
      if (io) {
          io.emit('updateLikes', { postId, likes: post.likes });
      }

      res.status(200).json({ success: true, likes: post.likes, liked: likedIndex === -1 });

  } catch (error) {
      console.error('Error al actualizar el like:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/post/comentar', async (req, res) => {
  const { email, postId, contenido } = req.body;

  if (!email || !postId || !contenido) {
      return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
      
      const usuarioPublicador = await User.findOne({ "publicaciones.id": postId });

      if (!usuarioPublicador) {
          return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
      }

      
      const post = usuarioPublicador.publicaciones.find(p => p.id === postId);

      if (!post) {
          return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
      }

      
      const usuarioComentador = await User.findOne({ email });

      if (!usuarioComentador) {
          return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      }

      
      const fotoPerfil = usuarioComentador.fotoPerfil 
          ? usuarioComentador.fotoPerfil 
          : "https://res.cloudinary.com/drrb19jky/image/upload/v1739061826/uploads/default_profile.jpg";

      console.log(` Usuario: ${usuarioComentador.username}`);
      console.log(` Foto de perfil asignada: ${fotoPerfil}`);

      // Crear comentario
      const nuevoComentario = {
          usuario: usuarioComentador.username,
          contenido,
          fecha: new Date(),
          fotoPerfil: fotoPerfil 
      };

      console.log(" Comentario agregado:", nuevoComentario);

      // Agregar comentario a la publicación
      post.comentarios.push(nuevoComentario);
      await usuarioPublicador.save();

      
      const io = req.app.get('io');
      if (io) {
          io.emit('updateComments', { postId, comments: post.comentarios });
      }

      res.status(200).json({ success: true, comentarios: post.comentarios });

  } catch (error) {
      console.error(' Error al agregar el comentario:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/api/publicaciones/obtener', async (req, res) => {
    const { id } = req.body; 

    if (!id) {
        return res.status(400).json({ success: false, message: 'ID de publicación requerido' });
    }

    try {
        
        const publicacion = await db.collection('publicaciones').findOne({ id });

        if (!publicacion) {
            return res.status(404).json({ success: false, message: 'Publicación no encontrada' });
        }

        
        res.status(200).json({
            success: true,
            publicacion,
        });
    } catch (error) {
        console.error('Error al obtener la publicación:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

router.post('/imagen/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se proporcionó archivo.' });
  }

  try {
    
    const result = await cloudinary.uploader.upload_stream(
      { folder: 'uploads' },
      (error, result) => {
        if (error) {
          return res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
        }
        res.json({ success: true, url: result.secure_url });
      }
    );
    result.end(req.file.buffer);
  } catch (error) {
    console.error('Error al subir la imagen:', error);
    res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
  }
});

router.get('/post/obtener/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
      return res.status(400).json({ success: false, message: 'ID de publicación requerido' });
  }

  try {
      
      const usuario = await User.findOne({ "publicaciones.id": id });

      if (!usuario) {
          return res.status(404).json({ success: false, message: 'Publicación no encontrada' });
      }

      
      const publicacion = usuario.publicaciones.find(pub => pub.id === id);
      const fechaPublicacion = publicacion.fecha ? new Date(publicacion.fecha) : new Date();

      res.status(200).json({
          success: true,
          publicacion: {
              id: publicacion.id,
              contenido: publicacion.contenido || "Sin descripción",
              imagen: publicacion.imagen || "", 
              likes: publicacion.likes || 0,
              comentarios: publicacion.comentarios || [],
              fecha: fechaPublicacion.toISOString(),  
              usuario: {
                  username: usuario.username,
                  fotoPerfil: usuario.fotoPerfil
              }
          }
      });
  } catch (error) {
      console.error('Error al obtener la publicación:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});




router.post('/perfil/stats', async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
      const user = await User.findOne({ email });

      if (!user) {
          return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      }

      
      const seguidoresCount = user.amigos ? user.amigos.length : 0;
      const seguidosCount = await User.countDocuments({ amigos: user._id });
      const comunidadesCount = user.comunidades ? user.comunidades.length : 0;

      console.log(`Stats del usuario ${email}:`);
      console.log(`Seguidores: ${seguidoresCount}`);
      console.log(`Seguidos: ${seguidosCount}`);
      console.log(`Comunidades: ${comunidadesCount}`);

      res.status(200).json({
          success: true,
          stats: {
              seguidores: seguidoresCount,
              seguidos: seguidosCount,
              comunidades: comunidadesCount
          }
      });

  } catch (error) {
      console.error('Error al obtener estadísticas del perfil:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/amigos', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    
    const user = await User.findOne({ email }).select('amigos solicitudesPendientes');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    
    const amigos = await User.find(
      { $or: [{ _id: { $in: user.amigos } }, { amigos: user._id }] }, 
      'username fotoPerfil email cuentaPrivada amigos solicitudesPendientes'
    );

    const amigosFormateados = amigos.map(amigo => {
      const sonAmigos = user.amigos.includes(amigo._id) && amigo.amigos.includes(user._id); 
      const solicitudPendiente = amigo.solicitudesPendientes.includes(user._id); 
      const yoLoTengo = user.amigos.includes(amigo._id);
      const elMeTiene = amigo.amigos.includes(user._id); 

      return {
        email: amigo.email,
        username: amigo.username,
        fotoPerfil: amigo.fotoPerfil,
        cuentaPrivada: amigo.cuentaPrivada,
        sonAmigos,
        solicitudPendiente,
        mostrarSeguir: yoLoTengo && !elMeTiene && !solicitudPendiente, 
        mostrarSolicitud: yoLoTengo && !elMeTiene && solicitudPendiente, 
      };
    });

    console.log(" Amigos procesados correctamente:", amigosFormateados);
    res.status(200).json({ success: true, amigos: amigosFormateados });

  } catch (error) {
    console.error('Error al obtener la lista de amigos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});





router.post('/perfil/seguidores', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    
    const currentUser = await User.findOne({ email }).select('amigos solicitudesPendientes');

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

  
    const seguidos = await User.find(
      { $or: [{ _id: { $in: currentUser.amigos } }, { amigos: currentUser._id }] },
      'username fotoPerfil email cuentaPrivada amigos solicitudesPendientes'
    );

    const seguidosFormateados = seguidos.map(seg => {
      const sonAmigos = currentUser.amigos.includes(seg._id) && seg.amigos.includes(currentUser._id); 
      const solicitudPendiente = seg.solicitudesPendientes.includes(currentUser._id); 
      const yoLoTengo = currentUser.amigos.includes(seg._id); 
      const elMeTiene = seg.amigos.includes(currentUser._id);

      return {
        email: seg.email,
        username: seg.username,
        fotoPerfil: seg.fotoPerfil,
        cuentaPrivada: seg.cuentaPrivada,
        sonAmigos,
        solicitudPendiente,
        mostrarSeguir: !sonAmigos && !solicitudPendiente, 
        mostrarSolicitud: solicitudPendiente, 
      };
    });

    console.log(" Seguidos procesados correctamente:", seguidosFormateados);
    res.status(200).json({ success: true, seguidos: seguidosFormateados });

  } catch (error) {
    console.error('Error al obtener seguidos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/solicitudes', async (req, res) => {
  const { email, tipo } = req.body;
  if (!email || !tipo) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const user = await User.findOne({ email })
      .populate({
        path: 'solicitudesPendientes',
        select: 'username fotoPerfil email cuentaPrivada'
      })
      .populate({
        path: 'amigos',
        select: 'username fotoPerfil email cuentaPrivada'
      })
      .populate({
        path: 'solicitudesFechas.usuario',
        select: 'username'
      });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    let solicitudes = [];

    if (tipo === 'recibidas') {
      solicitudes = user.solicitudesPendientes.filter(solicitante => {
        return !user.amigos.some(amigo => amigo._id.toString() === solicitante._id.toString());
      }).map(solicitante => {
        const solicitudInfo = user.solicitudesFechas.find(s => s.usuario._id.toString() === solicitante._id.toString());
        return {
          email: solicitante.email,
          username: solicitante.username,
          fotoPerfil: solicitante.fotoPerfil,
          cuentaPrivada: solicitante.cuentaPrivada,
          fecha: solicitudInfo ? solicitudInfo.fecha : new Date()
        };
      });
    } else if (tipo === 'enviadas') {
      const usuariosConSolicitudes = await User.find({ solicitudesPendientes: user._id })
        .select('username fotoPerfil email cuentaPrivada');
      solicitudes = usuariosConSolicitudes.map(usuario => ({
        email: usuario.email,
        username: usuario.username,
        fotoPerfil: usuario.fotoPerfil,
        cuentaPrivada: usuario.cuentaPrivada,
        fecha: new Date()
      }));
    } else if (tipo === 'aceptadas') {
      const usuariosAmigos = await User.find({ amigos: user._id })
        .select('username fotoPerfil email cuentaPrivada');
      solicitudes = usuariosAmigos.map(amigo => ({
        email: amigo.email,
        username: amigo.username,
        fotoPerfil: amigo.fotoPerfil,
        cuentaPrivada: amigo.cuentaPrivada
      }));
    }

    res.status(200).json({ success: true, solicitudes });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/agregar-amigo', async (req, res) => {
  const { email, amigoEmail } = req.body;

  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios." });
  }

  try {
    const user = await User.findOne({ email }); 
    const amigo = await User.findOne({ email: amigoEmail }); 

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: "Usuario o amigo no encontrado." });
    }

    if (amigo.amigos.includes(user._id)) {
      return res.status(400).json({ success: false, message: "Ya sigues a este usuario." });
    }

    await User.findOneAndUpdate(
      { email: amigoEmail },
      { $addToSet: { amigos: user._id } }, 
      { new: true }
    );

    
    amigo.seguidores += 1;
    user.seguidos += 1;
    await amigo.save();
    await user.save();

    
    const io = req.app.get('io');
    io.to(amigo._id.toString()).emit('updateStats', { 
      email: amigoEmail, 
      seguidores: amigo.seguidores,
      seguidos: user.seguidos
    });

    res.status(200).json({
      success: true,
      message: "Ahora sigues a este usuario.",
      stats: { 
        seguidores: amigo.seguidores, 
        seguidos: user.seguidos 
      }
    });

  } catch (error) {
    console.error("Error en agregar-amigo:", error);
    res.status(500).json({ success: false, message: "Error del servidor." });
  }
});


router.post('/perfil/devolver-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    await User.updateOne(
      { email: amigoEmail },
      { $addToSet: { solicitudesPendientes: email } }
    );
    await User.updateOne(
      { email },
      { $pull: { solicitudesPendientes: amigoEmail } }
    );
    res.status(200).json({ success: true, message: 'Solicitud devuelta correctamente.' });
  } catch (error) {
    console.error('Error al devolver la solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/eliminar-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    await User.updateOne(
      { email },
      { $pull: { solicitudesPendientes: amigoEmail } }
    );
    res.status(200).json({ success: true, message: 'Solicitud eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/mandar-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });
    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
    if (amigo.solicitudesPendientes.includes(user._id)) {
      return res.status(400).json({ success: false, message: 'Solicitud ya enviada.' });
    }
    await User.updateOne(
      { email: amigoEmail },
      { $addToSet: { solicitudesPendientes: user._id }}
    );
    res.status(200).json({ success: true, message: 'Solicitud enviada correctamente.' });
  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/aceptar-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const userA = await User.findOne({ email });
    const userB = await User.findOne({ email: amigoEmail });
    if (!userA || !userB) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    await User.updateOne({ email }, { $pull: { solicitudesPendientes: userB._id.toString() }, $addToSet: { amigos: userB._id } });
    await User.updateOne({ email: amigoEmail }, { $addToSet: { amigos: userA._id } });

    // Noti
    const nuevaNotificacion = new Notification({
      tipo: 'solicitud_aceptada',
      usuarioDestino: userB._id,
      usuarioOrigen: userA._id,
      mensaje: `${userA.username} ha aceptado tu solicitud de amistad.`,
      fecha: new Date()
    });

    await nuevaNotificacion.save();

    const io = req.app.get('io');
    io.to(userB._id.toString()).emit('nueva_notificacion', nuevaNotificacion);

    res.status(200).json({ success: true, message: 'Amistad confirmada y solicitud eliminada completamente.' });
  } catch (error) {
    console.error('Error al aceptar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/perfil/aceptar-solicitud-parcial', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const userB = await User.findOne({ email }).select('_id email solicitudesPendientes');
    const userA = await User.findOne({ email: amigoEmail }).select('_id email solicitudesPendientes');
    if (!userB || !userA) {
      return res.status(404).json({ success: false, message: 'Usuario o amigo no encontrado.' });
    }
    await User.updateOne(
      { email },
      { $addToSet: { amigos: userA._id }, $pull: { solicitudesPendientes: userA._id.toString() } }
    );
    res.status(200).json({ success: true, message: 'Solicitud aceptada parcialmente y solicitud pendiente eliminada.' });
  } catch (error) {
    console.error('Error al aceptar solicitud parcialmente:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/confirmar-aceptacion-sin-devolver', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const userB = await User.findOne({ email });
    const userA = await User.findOne({ email: amigoEmail });
    if (!userB || !userA) {
      return res.status(404).json({ success: false, message: 'Usuario o amigo no encontrado.' });
    }
    await User.updateOne(
      { email: amigoEmail },
      { $pull: { solicitudesPendientes: { $in: [userB._id, userB._id.toString()] } } }
    );
    await User.updateOne(
      { email },
      { $addToSet: { amigos: userA._id } }
    );
    res.status(200).json({ success: true, message: 'Amistad confirmada sin reciprocidad.' });
  } catch (error) {
    console.error('Error al confirmar amistad sin devolver:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/rechazar-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    await User.updateOne({ email }, { $pull: { solicitudesPendientes: amigo._id } });

    // Noti
    const nuevaNotificacion = new Notification({
      tipo: 'solicitud_rechazada',
      usuarioDestino: amigo._id,
      usuarioOrigen: user._id,
      mensaje: `${user.username} ha rechazado tu solicitud de amistad.`,
      fecha: new Date()
    });

    await nuevaNotificacion.save();

    const io = req.app.get('io');
    io.to(amigo._id.toString()).emit('nueva_notificacion', nuevaNotificacion);

    res.status(200).json({ success: true, message: 'Solicitud rechazada correctamente.' });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/cancelar-solicitud', async (req, res) => {
  const { email, amigoEmail } = req.body;
  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }
  try {
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });
    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
    if (!amigo.solicitudesPendientes.includes(user._id.toString())) {
      return res.status(400).json({ success: false, message: 'No hay solicitud pendiente.' });
    }
    const result = await User.updateOne(
      { email: amigoEmail },
      { $pull: { solicitudesPendientes: user._id.toString() } }
    );
    if (result.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: 'No se pudo cancelar la solicitud.' });
    }
    res.status(200).json({ success: true, message: 'Solicitud cancelada correctamente.' });
  } catch (error) {
    console.error('Error al cancelar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/eliminar-amigo', async (req, res) => {
  const { email, amigoEmail } = req.body;

  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
    const user = await User.findOne({ email });
    const amigo = await User.findOne({ email: amigoEmail });

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario o amigo no encontrado.' });
    }

    await User.updateOne({ email }, { $pull: { amigos: amigo._id } });
    await User.updateOne({ email: amigoEmail }, { $pull: { amigos: user._id } });

    
    const nuevaNotificacion = new Notification({
      tipo: 'amigo_eliminado',
      usuarioDestino: amigo._id,
      usuarioOrigen: user._id,
      mensaje: `${user.username} ha dejado de seguirte.`,
      fecha: new Date()
    });

    await nuevaNotificacion.save();

    const io = req.app.get('io');
    io.to(amigo._id.toString()).emit('nueva_notificacion', nuevaNotificacion);

    res.status(200).json({ success: true, message: 'Amigo eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar amigo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});

router.post('/perfil/eliminar-amigo-unilateral', async (req, res) => {
  const { email, amigoEmail } = req.body;

  if (!email || !amigoEmail) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
    const user = await User.findOne({ email }); 
    const amigo = await User.findOne({ email: amigoEmail }); 

    if (!user || !amigo) {
      return res.status(404).json({ success: false, message: 'Usuario o amigo no encontrado.' });
    }

    
    amigo.amigos = amigo.amigos.filter(a => a.toString() !== user._id.toString());

    
    if (amigo.seguidores > 0) amigo.seguidores -= 1;

    await amigo.save();

    
    const io = req.app.get('io');
    io.to(amigo._id.toString()).emit('updateStats', { 
      email: amigoEmail, 
      seguidores: amigo.seguidores,
      seguidos: amigo.seguidos
    });

    res.status(200).json({ 
      success: true, 
      message: 'Has dejado de seguir a este usuario.', 
      stats: { seguidores: amigo.seguidores, seguidos: amigo.seguidos } 
    });

  } catch (error) {
    console.error('Error al eliminar seguidor:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.post('/perfil/seguidos', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
    const user = await User.findOne({ email }).populate('amigos', 'username fotoPerfil email');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    
    const seguidos = await User.find({
      amigos: user._id 
    }, 'username fotoPerfil email');

    console.log(`Seguidos de ${email}:`, seguidos.map(u => u.email));
    res.status(200).json({ success: true, seguidos });

  } catch (error) {
    console.error('Error al obtener seguidos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});



router.post('/perfil/bloquear', async (req, res) => {
  const { email, bloqueadoEmail } = req.body;

  try {
    const user = await User.findOne({ email });
    const bloqueado = await User.findOne({ email: bloqueadoEmail });

    if (!user || !bloqueado) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!user.bloqueados.includes(bloqueado._id)) {
      user.bloqueados.push(bloqueado._id);
      await user.save();
    }

    res.json({ success: true, message: 'Usuario bloqueado' });
  } catch (error) {
    console.error('Error al bloquear usuario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});


router.post('/perfil/desbloquear', async (req, res) => {
  const { email, desbloqueadoEmail } = req.body;

  try {
    const user = await User.findOne({ email });
    const desbloqueado = await User.findOne({ email: desbloqueadoEmail });

    if (!user || !desbloqueado) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    user.bloqueados = user.bloqueados.filter(id => id.toString() !== desbloqueado._id.toString());
    await user.save();

    res.json({ success: true, message: 'Usuario desbloqueado' });
  } catch (error) {
    console.error('Error al desbloquear usuario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});


router.post('/perfil/bloqueados', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email }).populate('bloqueados', 'username email fotoPerfil cuentaPrivada');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    res.json({ success: true, bloqueados: user.bloqueados });
  } catch (error) {
    console.error('Error al obtener bloqueados:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/perfil/no-seguidos', async (req, res) => {
  console.log("Recibido en /no-seguidos:", req.body);

  const { email, amigoEmail } = req.body;

  if (!email || !amigoEmail) {
    console.error("ERROR: Faltan datos en la solicitud:", { email, amigoEmail });
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  try {
    const user = await User.findOne({ email }).select('_id amigos solicitudesPendientes');
    if (!user) {
      console.error("Usuario que consulta no encontrado:", email);
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const amigo = await User.findOne({ email: amigoEmail }).select('_id cuentaPrivada solicitudesPendientes amigos');
    if (!amigo) {
      console.error("Usuario objetivo no encontrado:", amigoEmail);
      return res.status(404).json({ success: false, message: 'El usuario a seguir no existe.' });
    }

    const sonAmigos = user.amigos.includes(amigo._id) && amigo.amigos.includes(user._id);
    const solicitudPendiente = amigo.solicitudesPendientes.includes(user._id);

    console.log("Estado de seguimiento:", { sonAmigos, solicitudPendiente, cuentaPrivada: amigo.cuentaPrivada });

    res.status(200).json({
      success: true,
      cuentaPrivada: amigo.cuentaPrivada,
      sonAmigos,
      solicitudPendiente
    });

  } catch (error) {
    console.error('Error en no-seguidos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});


router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await User.find({}, 'username fotoPerfil email cuentaPrivada');

    res.status(200).json({ success: true, usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});




router.post('/perfil/comunidades', async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }

  try {
      const user = await User.findOne({ email }).populate('comunidades', 'nombre foto comunidadId');
      
      if (!user) {
          return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      }

      res.status(200).json({ success: true, comunidades: user.comunidades });

  } catch (error) {
      console.error('Error al obtener la lista de comunidades:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
  }
});








module.exports = router;