const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);

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
    const paymentsCollection = client.db("booksResale").collection("payments");

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

    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "myr",
        amount: amount,
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //save payment info to DB
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const itmId = payment.itemId;
      const filter = { _id: ObjectId(id) };
      const filter2 = { _id: ObjectId(itmId) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedBook = {
        $set: {
          status: "Paid",
        },
      };
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc);
      const updatedResult2 = await booksCollection.updateOne(filter2, updatedBook, options);
      res.send(result);
    });

    //verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "This is admin only functionality" });
      }
      next();
    };

    //verify admin middleware
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "seller") {
        return res.status(403).send({ message: "This is seller only functionality" });
      }
      next();
    };

    //check admin
    app.get("/users/admin/:email", async (req, res) => {
      const mail = req.params.email;
      const query = { email: mail };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //check if user is seller
    app.get("/users/seller/:email", async (req, res) => {
      const mail = req.params.email;
      const query = { email: mail };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });

    //get sellers
    app.get("/sellers", async (req, res) => {
      const query = { role: "seller" };
      const sellers = await usersCollection.find(query).toArray();
      res.send(sellers);
    });

    //delete sellers
    app.delete("/sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    //get buyers
    app.get("/buyers", async (req, res) => {
      const query = { role: "buyer" };
      const buyers = await usersCollection.find(query).toArray();
      res.send(buyers);
    });

    //delete buyers
    app.delete("/buyers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
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
    app.put("/sellers/verified/:id", verifyJWT, verifyAdmin, async (req, res) => {
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

    //get one booking by its Id
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
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

    //get books under specific seller
    app.get("/books/:email", verifyJWT, async (req, res) => {
      const mail = req.params.email;
      const query = { sellerEmail: mail };
      const books = await booksCollection.find(query).toArray();
      res.send(books);
    });

    //get advertised books
    app.get("/advertisedbook", async (req, res) => {
      const query = { advertised: true };
      const books = await booksCollection.find(query).toArray();
      res.send(books);
    });

    //post add books for resale
    app.post("/books", async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
    });

    //delete own book by seller him/her-self
    app.delete("/books/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await booksCollection.deleteOne(filter);
      res.send(result);
    });

    //report a book by the buyers
    app.put("/reportitem/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          reportedStatus: "reported",
        },
      };
      const result = await booksCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

    //advertise item by seller
    app.put("/advertise/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          advertised: true,
        },
      };
      const result = await booksCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

    //view all reported item
    app.get("/reporteditems", verifyJWT, verifyAdmin, async (req, res) => {
      const filter = { reportedStatus: "reported" };
      const result = await booksCollection.find(filter).toArray();
      res.send(result);
    });

    //delete an reported item by admin
    //delete own book by seller him/her-self
    app.delete("/reportedbook/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await booksCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
