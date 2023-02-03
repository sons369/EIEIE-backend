const db = require('mysql2');
require('dotenv').config();

const pool = db.createPool({
    host : process.env.DB_HOST,
    user : process.env.DB_USER,
    password : process.env.DB_KEY,
    database : process.env.DB_NAME,
    connectionLimit : 10
}).promise();

const api = {
    login: async (email, pw) =>{
        const [res] = await pool.query(`select email from ${process.env.LOGIN_TABLE} where email = '${email}' and password = '${pw}'`)
        return res;
    },

    register: async (email, pw)=>{
        const [res] = await pool.query(`insert into member(email, password) values('${email}', '${pw}')`);
        return res;
    },

    isMember: async (email) =>{
        const [res] = await pool.query(`select email from ${process.env.LOGIN_TABLE} where email = '${email}'`);
        return res;
    },

    report: async(email, title, addr, content, img)=>{
        const [res] = await pool.query(`insert into report(email, title, address, content, image, date) values('${email}','${title}', '${addr}', '${content}', '${img}', now())`);
        return res;
    },

    reports: async(user)=>{
        const [res] = await pool.query(`select * from report where email = '${user}'`);
        return res
    }
}

module.exports = new Proxy(api,{
    get: (target, apiName, receiver)=>{
        if(apiName == 'login'){
            return async function(email, pw){
                if(email && pw)
                    return await target.login(email, pw);
                else
                    return null;
            }
        }

        else if(apiName == 'isMember'){
            return async function(email){
                if(email)
                    if(await target.isMember(email))
                        return await target.isMember(email);
                    else
                        return null;
                else
                    return null;
            }
        }

        else if(apiName == 'register'){
            return async function(email, pw){
                if(email && pw)
                    return await target.register(email, pw);
                else
                    return null;
            }
        }

        else if(apiName =='report'){
            return async function(email, title, addr, content, img){
                if(email && title && content && img && addr)
                    return await target.report(email, title, addr, content, img);
                else
                    return null;
            }
        }

        else if(apiName == 'reports'){
            return async function(user){
                if(user)
                    return await target.reports(user);
                else
                    return null;
            }
        }
    }
})