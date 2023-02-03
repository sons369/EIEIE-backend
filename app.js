const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors')
require('dotenv').config();

const indexRouter = require('./routes');
const usersRouter = require('./routes/users');

const app = express();

const sessionMiddleware = session({
  resave: false,
  saveUninitialized: false,
  secret: `${process.env.COOKIE_SECRET}`,
  cookie: {
    httpOnly: true,
    secure: false,
  },
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.set('port', process.env.PORT || 3000);

app.use(logger('dev'));

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/image', express.static('./uploads'));

//catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

app.get('/', (req,res)=>{
  console.log("main page");
  res.render('index');
})

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기중입니다.');
});

module.exports = app;
