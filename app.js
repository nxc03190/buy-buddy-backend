const express = require('express');
const app = express();
const con = require("./dbConnection")
const morgan = require('morgan');
const bodyParser  = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
var syncSql = require('sync-sql');

dbDetails_async = {
  host: "my-buy-buddy-server.mysql.database.azure.com",
  user: "buybuddyadmin",
  password: "Ramesh1@",
  database: "buybuddy"
}

app.use(morgan('dev'))
app.use(bodyParser.urlencoded({limit: '1000mb',extended: false}))
app.use(bodyParser.json())
app.use(express.json());
app.use((req,res,next)=>{
    res.header('Access-Control-Allow-Origin','*')
    res.header('Access-Control-Allow-Headers','Origin, X-Requested-Width, Content-Type, Accept, Authorization')
    if(req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods','PUT, POST, PATCH, GET, DELETE')
        return res.status(200).json({})
    }
    next()
})


app.post('/uerReg', function(req, res) {
   const postData = req.body;
   let sql = "select count(*) as userCount from user where email='"+postData['email']+"' or phone='"+postData['phone']+"'";
   let userCount= syncSql.mysql(dbDetails_async, sql)
   userdata = userCount['data']['rows'][0]['userCount']
   if(userdata>0){
     res.json({ message: 'Duplicate User Details'});
   }
   else{
   let sql2 = "insert into user (name,email,phone,password) values('"+postData.name+"','"+postData.email+"','"+postData.phone+"','"+postData.password+"')";
   con.query(sql2, function (err, result) {
    res.json({ message: 'User Added  successfully!'});
  });
   }
})

app.post("/uLogin",function(req,res){
  const postData = req.body;
  var sql = "select * from user where email='"+postData.email+"' and password='"+postData.password+"'";
  con.query(sql,function(err,result){
    if(result.length>0){
      const token =  jwt.sign({ email: result[0].email.trim().toUpperCase(), userId: result[0].userId}, process.env.secret,{ expiresIn: '1h' })
        // if(res.status(200).json({
        //     token:token,
        //     authorization: "success",
        //     userId  : result[0].userId
        // } ) );
        // else{
        //    res.send("Something Went Wrong");
        // }
        res.status(200).json({
          token: token,
          authorization: "success",
          userId: result[0].userId
        });
      }
      else[
        res.send("Invalid Login Details")
      ]
  })
})

app.post("/addCategories",function(req,res){
  const postData = req.body;
  var sql = "insert into categories (categoryName) values('"+postData.categoryName+"')";
  con.query(sql,function(err,result){
    res.send("Category Added Successfully");
  })
})

app.get("/categories",function(req,res){
  var sql = "select * from categories";
  con.query(sql,function(err,result){
    res.send(result);
  })
})



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, "public")
  },
  filename: function (req, file, cb) {
      const parts = file.mimetype.split("/");
      cb(null, `${file.fieldname}-${Date.now()}.${parts[1]}`)
  }
})
const upload = multer({storage});
fs = require('fs');


app.post("/addProduct",upload.single("image"),function(req,res){
  const imageData = req.file.filename;
  const postData = req.body;
  const token =  req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const user_id = user.userId
  var sql = "insert into products (title,price,about,image,categoryId,userId) values('"+postData.title+"','"+postData.price+"','"+postData.about+"','"+imageData+"','"+postData.categoryId+"','"+user_id+"')";
  con.query(sql,function(err,result){
    res.send("Product Added Successfully");
  })
   

  
})
app.use(express.static("public"));

app.get("/products",function(req,res){
  let searchKeyword = req.query.searchKeyword;
  let categoryId = req.query.categoryId;
  let sql = ''
  if(categoryId==="" && searchKeyword===''){
     sql = "select * from products";
  }else if(categoryId==='' && searchKeyword!=''){
    sql = "select * from products where title like '%" +(searchKeyword) + "%'";
  }else if(categoryId!=''&&searchKeyword===''){
    sql = "select * from products where categoryId='"+categoryId+"'";
  }
  else if(categoryId!=''&& searchKeyword!=''){
    sql = "select * from products where categoryId='"+categoryId+"' and title like '%" +(searchKeyword) + "%'";
  }
  con.query(sql,function(err,results){
    let products = []
    for(let i=0;i<results.length;i++){
         const contents = fs.readFileSync('./public/'+results[i]['image'], {encoding: 'base64'});
         let product= results[i];
         product['image'] = contents;
         let sql2 = "select avg(rating) as rating from reviews  where productid='"+results[i]['productid']+"'";
         let rating = syncSql.mysql(dbDetails_async, sql2)
         rating = rating['data']['rows'][0]['rating']
         product['rating'] = rating;
         products.push(product)
    }
    res.send(products);
  })
})



app.get("/addToCart",function(req,res){
  var productId = req.query.productId;
  var quantity = req.query.quantity;
  let sellerId = req.query.userId;
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const buyerId = user.userId;
  
  var sql = "select * from orders where sellerId='"+sellerId+"' and buyerId='"+buyerId+"' and status='cart'";
  con.query(sql,function(err,result){
    let orderId = '';
    if(result.length==0){
      var sql2 = "insert into orders(sellerId,buyerId) values('"+sellerId+"','"+buyerId+"')";
       con.query(sql2,function(err,result2){
        orderId = result2.insertId;
        addToCart(orderId,productId,quantity,res)
      })
    }else{
     var sql3 = "select * from orders where  sellerId='"+sellerId+"' and buyerId='"+buyerId+"' and status='cart'";
     con.query(sql3,function(err,result3){
      orderId = result3[0].orderId;
      addToCart(orderId,productId,quantity,res)
     })
    }
  })
  

})

function addToCart(orderId,productId,quantity,res){
  const sql4 = "select * from orderItems where orderId='"+orderId+"' and productid='"+productId+"'";
  con.query(sql4,function(err,result4){
    if(result4.length==0){
      var sql5 = "insert into orderItems(quantity,orderId,productid) values('"+quantity+"','"+orderId+"','"+productId+"')";
      con.query(sql5,function(err,result5){
        res.send("Item Added To Cart")
      })
    }else{
      var sql6 = "update orderItems set quantity=quantity+ "+(quantity)+" where  orderId='"+orderId+"' and productid='"+productId+"'";
      con.query(sql6,function(err,result6){
        res.send("Item Updated To Cart")
      })
    }
  })
}

app.get("/vieworders",async function(req,res){
  let status = req.query.status;
  if(status==='cart'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where buyerId = '"+userId+"' and status='cart' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);

  }else if(status==='ordered'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where buyerId = '"+userId+"'  and status='ordered' or status='Dispatched' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }else if(status=='received'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where sellerId = '"+userId+"'  and status='ordered' or status='Dispatched' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }
  else if(status==='dispatched'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where sellerId = '"+userId+"'  and status='Dispatched' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }else if(status==='history'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where buyerId = '"+userId+"'  and status='Delivered' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }
    


})


app.get("/ordersHistory",async function(req,res){
  let status = req.query.status
    if(status==="delivered" && !status==='history' && !status==='receivedHistory' && !status==='ordered'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where buyerId = '"+userId+"' or sellerId = '"+userId+"'  and  status='Delivered' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]

        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }else if(status==='history'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where buyerId = '"+userId+"'  and status='Delivered' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }else if(status==='receivedHistory'){
    let token = req.header("Authorization");
    const tokenParts = token.split('.');
    const encodedPayload = tokenParts[1];
    const rawPayload = atob(encodedPayload);
    const user = JSON.parse(rawPayload);
    const userId = user.userId;
    let sql = "select * from orders where sellerId = '"+userId+"'  and status='Delivered' ";
    let orders = syncSql.mysql(dbDetails_async, sql)
    orders = orders['data']['rows'];
    let buyerOrders = []
    for(let i=0;i<orders.length;i++){
      let order = orders[i]
      let query = "select * from user where userId='"+order['sellerId']+"'";
      let seller = syncSql.mysql(dbDetails_async, query)
      seller = seller['data']['rows'][0]
      order['seller'] = seller
      query = "select * from user where userId='"+order['buyerId']+"'";
      let buyer = syncSql.mysql(dbDetails_async, query)
      buyer = buyer['data']['rows'][0]
      order['buyer'] = buyer
      query = "select * from orderitems where orderId='"+order['orderId']+"'";
      let ordersitems = syncSql.mysql(dbDetails_async, query)
      ordersitems = ordersitems['data']['rows'];
      let orderItems2 = []
      let totalPrice = 0;
      for(let j=0;j<ordersitems.length;j++){
        let orderItem = ordersitems[j]
        let subTotal = 0
        query = "select * from products where productid='"+orderItem['productid']+"'";
        let product = syncSql.mysql(dbDetails_async, query)
        product = product['data']['rows'][0]
        const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
        product['image']  = contents;
        orderItem['product'] = product
        subTotal = parseInt(product['price']*parseInt(orderItem['quantity']))
        orderItem['subTotal'] = subTotal;
        totalPrice = totalPrice+subTotal
        orderItems2.push(orderItem)
      }
      order['totalPrice'] = totalPrice
      let buyerOrder = {
        "order":order,
        "orderItems":orderItems2
        
      }
      buyerOrders.push(buyerOrder)
    }
    res.send(buyerOrders);
  }
})

app.get("/addToWishList",async function(req,res){
  let productId = req.query.productId;
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const userId = user.userId;
  let query = "insert into wishlist(productid,userId) values('"+productId+"','"+userId+"')";
  syncSql.mysql(dbDetails_async, query)
  res.send("Product Added To WishList")
})

app.get("/viewWishList",async function(req,res){
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const userId = user.userId;
  let productid = req.query.productid
  let query = "select * from wishlist where   userId='"+userId+"'";
  let results = syncSql.mysql(dbDetails_async, query)
  results = results['data']['rows']
  let products = []
  for(let i=0;i<results.length;i++){
    let productid = results[i]['productid'];
    let query = "select * from products where productid='"+productid+"'";
    let product= syncSql.mysql(dbDetails_async, query)
    product = product['data']['rows'][0]
    const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
    product['image'] = contents;
    products.push(product)
}
res.send(products)
})
 

app.post("/removeCart",async function(req,res){
  const postData = req.body;
  let orderId  = postData.orderId;
  let orderItemId  = postData.orderItemId;
  let query = "delete  from orderItems where itemId='"+orderItemId+"'";
  syncSql.mysql(dbDetails_async, query)
  let query2 = "select * from orderItems where orderId='"+orderId+"'";
  let result =  syncSql.mysql(dbDetails_async, query2)
  let itemCount = result['data']['rows'];
  if(itemCount.length==0){
    let query3 = "delete  from orders where orderId='"+orderId+"'";
    syncSql.mysql(dbDetails_async, query3)
    res.setHeader("Message", "Cart & Item Removed")
  }
  res.send("Item Removed Successfully")

})

app.get("/orderNow",function(req,res){
  let orderId = req.query.orderId;
  let query = "update orders set status='ordered' where orderId='"+orderId+"'";
  syncSql.mysql(dbDetails_async, query)
  res.send("Order Placed")
})

app.get("/WishListCount",function(req,res){
  let productId = req.query.productId;
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const userId = user.userId;
  let query = "select count(*) as count from  wishlist where userId='"+userId+"' and productid='"+productId+"'";
  let result = syncSql.mysql(dbDetails_async, query)
  result = result['data']['rows'][0]
  res.send(result)

})


app.get("/dispatchOrder",function(req,res){
  let orderId = req.query.orderId;
  let query = "update orders set status='Dispatched' where orderId='"+orderId+"'";
  syncSql.mysql(dbDetails_async, query)
  res.send("Order Dispatched")
})


app.get("/makeasRecieved",function(req,res){
  let orderId = req.query.orderId;
  let query = "update orders set status='Delivered' where orderId='"+orderId+"'";
  syncSql.mysql(dbDetails_async, query)
  res.send("Order Delivered")
})



app.get("/getProducts",async function(req,res){
  let searchKeyword = req.query.searchKeyword;
  let categoryId = req.query.categoryId;
  let sql = ''
  if(categoryId==="" && searchKeyword===''){
     sql = "select * from products";
  }else if(categoryId==='' && searchKeyword!=''){
    sql = "select * from products where title like '%" +(searchKeyword) + "%'";
  }else if(categoryId!=''&&searchKeyword===''){
    sql = "select * from products where categoryId='"+categoryId+"'";
  }
  else if(categoryId!=''&& searchKeyword!=''){
    sql = "select * from products where categoryId='"+categoryId+"' and title like '%" +(searchKeyword) + "%'";
  }
  con.query(sql,function(err,results){
    let products = []
    for(let i=0;i<results.length;i++){
         const contents = fs.readFileSync('./public/'+results[i]['image'], {encoding: 'base64'});
         let product= results[i];
         product['image'] = contents;
         let sql2 = "select avg(rating) as rating from reviews where productid='"+product['productid']+"'";
        let rating = syncSql.mysql(dbDetails_async, sql2)
        rating = rating['data']['rows'][0]['rating']
        product['rating'] = rating;
         products.push(product)
    }
    res.send(products);
  })
})

app.post("/giveRating",function(req,res){
  let postData = req.body;
  let productid = postData.productid;
  let rating = postData.rating;
  let review = postData.review;
  const token =  req.header("Authorization");
   const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  let userId = user.userId
  let sql = "insert into reviews(productid,userId,rating,review) values('"+productid+"','"+userId+"','"+rating+"','"+review+"')";
  syncSql.mysql(dbDetails_async, sql)
  res.send("Response Submited")

})

app.get("/userProfile",function(req,res){
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const userId = user.userId;
  let sql  = "select * from user where userId='"+userId+"'";
  let users = syncSql.mysql(dbDetails_async, sql)
  users = users['data']['rows'][0]
  res.send(users)
})


app.get("/getProductDetails",function(req,res){
  let productid = req.query.productid;
  let sql = "select * from products where productid='"+productid+"' ";
  let product = syncSql.mysql(dbDetails_async, sql);
  product = product['data']['rows'][0]
  const contents = fs.readFileSync('./public/'+product['image'], {encoding: 'base64'});
  product['image'] = contents;
  let sql4 = "select * from categories where categoryId='"+product['categoryId']+"'";
  let categories = syncSql.mysql(dbDetails_async, sql4);
  categories = categories['data']['rows'][0];
  let sql3 = "select avg(rating) as rating from reviews where productid='"+product['productid']+"'";
  let reviewCount = syncSql.mysql(dbDetails_async, sql3);
  product['rating'] =  reviewCount['data']['rows'][0]['rating'];
  let sql2  ="select * from reviews where productid='"+product['productid']+"'";
  let reviews = syncSql.mysql(dbDetails_async, sql2);
  reviews = reviews['data']['rows']
   let reviews2 = []
  if(reviews.length!=0){
    for(let i=0;i<reviews.length;i++){
      let review = reviews[i]
      let sql3  ="select * from user where userId='"+review['userId']+"'";
      let users = syncSql.mysql(dbDetails_async, sql3);
      review['user']  = users['data']['rows'][0]
      reviews2.push(review)
    }
  }
  let productDetails = [product, reviews2,categories]
  res.send(productDetails)


})

app.get("/getSimilarProducts",function(req,res){
  let categoryId = req.query.categoryId;
  let sql = "select * from products where categoryId='"+categoryId+"' and status='Enabled' ";
  let product = syncSql.mysql(dbDetails_async, sql);
  product = product['data']['rows']
  let products = []
    for(let i=0;i<product.length;i++){
         const contents = fs.readFileSync('./public/'+product[i]['image'], {encoding: 'base64'});
         let product2= product[i];
         product2['image'] = contents;
         let sql2 = "select avg(rating) as rating from reviews where productid='"+product[i]['productid']+"'";
         let rating = syncSql.mysql(dbDetails_async, sql2)
         rating = rating['data']['rows'][0]['rating']
         product2['rating'] = rating;
         products.push(product2)
    }
  res.send(products)
})


app.get("/getCartCount", function(req,res){
  let token = req.header("Authorization");
  const tokenParts = token.split('.');
  const encodedPayload = tokenParts[1];
  const rawPayload = atob(encodedPayload);
  const user = JSON.parse(rawPayload);
  const userId = user.userId;
  let sql = "select * from orders where buyerId='"+userId+"' and status='cart'";
  let orders = syncSql.mysql(dbDetails_async, sql)
  let orderItems  = []
  if(orders['data']['rows'].length!=0){
     let orderId = orders['data']['rows'][0]['orderId']
     let sql2 = "select count(*) as cartData from orderItems where orderId='"+orderId+"' ";
     let orderItem = syncSql.mysql(dbDetails_async, sql2);
     orderItem = orderItem['data']['rows'][0]['cartData']
     orderItems.push(orderItem)
  }
  else{
    let orderItem = 0
    orderItems.push(orderItem)
  }
  res.send(orderItems)

})


app.get("/productStatusAction",function(req,res){
  let productId = req.query.productId;
  let sql = "select * from products where productid='"+productId+"'";
  let products = syncSql.mysql(dbDetails_async, sql)
  
  products = products['data']['rows'][0]
  if(products['status']==='Enabled'){
    let sql2 = "update products set status='Disabled' where productid='"+productId+"'";
    let result = syncSql.mysql(dbDetails_async, sql2)
    res.send("Disabled")
  }else{
    let sql3 = "update products set status='Enabled' where productid='"+productId+"'";
    let result = syncSql.mysql(dbDetails_async, sql3)
    res.send("Enabled")
  }
})



app.use((req, res, next) => {
   const error = new Error('Not Found!');
   error.status = 404;
   next(error);
 });
 app.use((error, req, res, next) => {
   res.status(error.status || 500);
   res.json({
     error: {
       message: error.message,
     },
   });
 });

module.exports = app;