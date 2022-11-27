const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("book resale server is running");
});

app.listen(port, () => {
  console.log(`book resale running at port ${port}`);
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bvgttje.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//verify JWT
function verifyJWT(req, res, next) {
  const verifyHeader = req.headers.authorization;
  if (!verifyHeader) {
    return res.status(401).send("Unauthorized access");
  }
  const token = verifyHeader.split(" ")[1];

  jwt.verify(token, process.env.ACC_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const usersCollection = client.db("booksResale").collection("users");
    const booksCollection = client.db("booksResale").collection("books");
    const bookingsCollection = client.db("booksResale").collection("bookings");
    const categoriesCollection = client.db("booksResale").collection("bookCategories");

    //jwt
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACC_TOKEN, {});
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    //get sellers
    app.get("/sellers", async (req, res) => {
      const query = { role: "seller" };
      const sellers = await usersCollection.find(query).toArray();
      res.send(sellers);
    });

    //get buyers
    app.get("/buyers", async (req, res) => {
      const query = { role: "buyer" };
      const buyers = await usersCollection.find(query).toArray();
      res.send(buyers);
    });

    //create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //verify seller
    /* app.get("/sellers/verified/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      res.send("api hit");
    }); */
    app.put("/sellers/verified/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          sellerVerified: "verified",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

    //get categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    //get bookings by buyer email
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { buyerEmail: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    //post bookings
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        itemId: booking.itemId,
        buyerEmail: booking.buyerEmail,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = "You have already booked this item";
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    //get books under specific category
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { category: id };
      const books = await booksCollection.find(query).toArray();
      res.send(books);
    });

    //post add books for resale
    app.post("/books", async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
