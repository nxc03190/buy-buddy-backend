const jwt = require('jsonwebtoken');

module.exports = (req,res,next) => {
    try{
        const token = req.headers.authorization.split(" ")[1]
        const decode = jwt.verify(token,process.env.secret);
        req.userData = decode;
        next();
    } catch(err) {
        return res.status(401).json({
            message: 'Auth Failed'
        })
    }
}