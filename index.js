const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

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

async function run() {
  try {
    const usersCollection = client.db("booksResale").collection("users");
    const booksCollection = client.db("booksResale").collection("books");
    const bookingsCollection = client.db("booksResale").collection("bookings");
    const categoriesCollection = client.db("booksResale").collection("bookCategories");

    //create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //get categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    //post bookings
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        itemId: booking.itemId,
        buyerEmail: booking.buyerEmail,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked) {
        const message = "You have already booked this item";
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send();
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
