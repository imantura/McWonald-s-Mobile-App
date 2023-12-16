const http = require("http");
const path = require("path");
const bodyParser = require("body-parser");
const express = require('express'); // Import Express
const portNumber = 7823; 
const fs = require('fs');
const app = express(); // Create an Express app

app.use(bodyParser.urlencoded({extended:false}));

process.stdin.setEncoding("utf8");

require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') }) 

console.log(`Web server started and running at http://localhost:${portNumber}`);
const prompt = "Type stop to shutdown the server: ";
process.stdout.write(prompt);

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

/*Mong DB*/
const userName = process.env.MONGO_DB_USERNAME; 
const password = process.env.MONGO_DB_PASSWORD; 
const database = process.env.MONGO_DB_NAME; 
const collect = process.env.MONGO_COLLECTION; 

const uri = `mongodb+srv://${userName}:${password}@cluster0.yl2utct.mongodb.net/?retryWrites=true&w=majority`; 
const databaseAndCollection = {db: database, collection: collect};
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

/*Api Variables*/
let latitude; 
let longitude; 

let irb_latitude = 38.989123; 
let irb_longitude = -76.936558; 
let apiKey = '4yoa22uqHZfWkEp4YyOBN2PJ9uFnvft7NUzNQgBP02Gz2sjTOfzEg5thungJuGHq';
let origin = `${irb_latitude},${irb_longitude}`;

/*homepage*/
app.get('/', (req, res) => {
  res.render('home');
});
app.get('/home', (req, res) => {
  res.render('home');
});

/*menu*/
app.get('/menu', (req, res) => {
  res.render('menu'); 
});

/*place order*/
app.get('/placeOrder', (req, res) => {
  res.render('placeOrder'); 
});

app.post('/placeOrder', async(req, res) => {
  let name = req.body.name; 
  let email = req.body.email; 
  let delivery = req.body.delivery; 
  let geolocation; 
  let ordertime = ""; 
  let quantity_count = 0; 

  let phone = req.body.phone; 
  let items_obj = {};
  let items = ""; 
  const menuItems = ['Nuggets', 'Wing', 'Salad', 'Burger', 'Beverage', 'Fries', 'Milkshake'];
  let card = req.body.credit_card; 
  let code = req.body.security_code; 
  let info = req.body.info; 

  menuItems.forEach(item => {
    const itemName =item;
    const quantity = parseInt(req.body[`${item}Quantity`]);
    items += `Item: ${item}&nbsp;&nbsp;&nbsp;&nbsp;`; 
    items_obj[itemName] = quantity;
    quantity_count = quantity_count + quantity; 
    items += `Quantity: ${items_obj[itemName]}<br>`; 
  });


  if(delivery === "deliver"){
    if(req.body.geo === "geotag"){
      geolocation = "<strong>Will we use your Geolocation! Check the bottom of this recciept for distance.</strong><br></br>"; 
      let resulting = await geo_time(); 
      ordertime += "<br><br> Using the geolocation we have determined the fastest distance to your location is " + resulting; 
      let timer = await delivery_time(); 
      ordertime += ". We will arrive in approximately " + parseFloat(((quantity_count * 1.5) + (timer/60))).toFixed(2) + " minutes."; 
    }else{
      let addy = req.body.address; 
      ordertime = "<br><br>We will give you a call when your order is ready and 15 minutes before we arrive."; 
      geolocation = `<strong>Will we rely on your address. Your address is: ${addy}</strong><br></br>`; 
    }
  }else{
    geolocation = `<strong>Pick up will be soon! Check the bottom of you recciept to see pick up time.</strong><br>`
    ordertime = "<br><br>Your order will be ready to pick up in " + ((quantity_count * 1.5) + 5) + " minutes"; 
  } 
  let count; 
  try {
        await client.connect();
        count = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .countDocuments();
        count = count + 1; 
        const order_online = {name: name, order: items_obj, phone: phone, email: email, count: count.toString(), specfications: info}; 
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(order_online);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

  const currentDate = new Date();
  const date = currentDate.toString(); 

  const variables = {
    id: count, 
    name: name, 
    email: email, 
    delivery: delivery, 
    geolocation: geolocation, 
    phone: phone, 
    items: items,
    card: card, 
    code: code,  
    info: info, 
    time: date, 
    ordertime: ordertime
  };
  res.render('receipt.ejs', variables); 
});

/* Employee Page login*/
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  res.render('redirectToFulfill');
})

/*fulfill order*/
app.get('/fulfillOrder', async(req, res) => {
  let orderList = "";
  let result; 
  let count; 
    try {
        await client.connect();
        let filter = {};
        cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        count = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .countDocuments();
        result = await cursor.toArray();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

    if(count > 0){
      const menuItems = ['Nuggets', 'Wing', 'Salad', 'Burger', 'Beverage', 'Fries', 'Milkshake'];
      orderList += "<select name=\"orderSelect\" id=\"order\" onchange=\"myFunction()\"multiple>"; 
      result.forEach(element => {
        orderList += `<option value="${element.count}">Order Number: ${element.count}&nbsp;&nbsp;&nbsp; Order name: ${element.name}&nbsp;&nbsp;&nbsp; Order: `; 
        menuItems.forEach(item => {
          if(element.order[item] >=  0){
            orderList += `${item}: ${element.order[item]}&nbsp;&nbsp;&nbsp;`;
          }
        });
        orderList += `Specifications: ${element.specfications}&nbsp;&nbsp;&nbsp;`
        orderList += '</option>'; 
      });
      orderList += "</select>"; 
    }else{
      orderList += "Nothing in database at the moment. Please refresh or return to home."
    }
    
  const variables = {
    orderList: orderList
  }; 
  res.render('fulfillOrder', variables);
});

app.post('/fulfillOrder', async(req, res) => {
  let deleting_orders = req.body.orderSelect; 
  let result = 0; 
  if(Array.isArray(deleting_orders)){
      try{
        await client.connect();
        for (const element of deleting_orders) {
          let filter = {count: element};
          let deleter = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).deleteMany(filter);
          result += deleter.deletedCount;
        } 
      } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    
  }else{
    try{
        await client.connect();
        let filter = {count: deleting_orders};
        const deleter = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).deleteMany(filter);
        result += deleter.deletedCount;
      } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
  }
  const variables = {
    number: result
  }
  res.render('confirmation', variables);
});

app.listen(portNumber);


process.stdin.on("readable", function () {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
      let command = dataInput.trim();
      if (command === "stop") {
        process.stdout.write("Shutting down the sever\n");
        process.exit(0);
      }else{
        process.stdout.write(`Invalid Command: ${command}\n`);
    }
      process.stdout.write(prompt);
      process.stdin.resume();
    }
  });

/*API request async function*/
async function geo_time(){
  let durationText; 
  let response1 = await fetch('https://ipapi.co/json/'); 
  let ll = await response1.json(); 
  latitude = ll.latitude; 
  longitude = ll.longitude;
  let destination = `${latitude},${longitude}`;
  let apiUrl = `https://api.distancematrix.ai/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;
  let response2 = await fetch(apiUrl); 
  let dist = await response2.json(); 
  durationText = dist.rows[0].elements[0].duration.text;
  return durationText; 
}

async function delivery_time(){
  let durationText; 
  let response1 = await fetch('https://ipapi.co/json/'); 
  let ll = await response1.json(); 
  latitude = ll.latitude; 
  longitude = ll.longitude;
  let destination = `${latitude},${longitude}`;
  let apiUrl = `https://api.distancematrix.ai/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;
  let response2 = await fetch(apiUrl); 
  let dist = await response2.json(); 
  durationText = dist.rows[0].elements[0].duration.value;
  return durationText; 
}