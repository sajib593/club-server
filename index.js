const express = require('express')
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// llrGAtLrl8ktqNFj 
// middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello club!')
})




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://club:llrGAtLrl8ktqNFj@cluster0.vkkq9zu.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    let db = client.db('club')
    let usersCollection = db.collection('users')
    let clubsCollection = db.collection('clubs')
    let memberShipCollection = db.collection('memberShip')
    let paymentCollection = db.collection('payment')
    let eventCollection = db.collection('events')
    let eventRegisterCollection = db.collection('registerEvent')

    // users related api -------------------------- 

    // register++++++++++++++
    app.post('/users', async(req, res)=>{
      let user = req.body;
      user.role = 'member';
      user.createdAt = new Date();
      let email = user.email;
      let userExist = await usersCollection.findOne({email})

      if(userExist){
        return res.send({message: 'user exist'})

      }

      let result  = await usersCollection.insertOne(user)
      res.send(result)
    })


    // UseRole +++++++++++++++++
    app.get('/users/:email/role', async(req,res)=>{
      let email = req.params.email;
      let query = {email}
      let user = await usersCollection.findOne(query);
      res.send({role: user?.role || 'user'})
    })



    // manager related api --------------------------- 

    // SelfClubMembers +++++++++++++++++++++++++ 
    app.get("/manager/:email/members", async (req, res) => {
    try {
        const { email } = req.params;

        
        const clubs = await clubsCollection.find({ managerEmail: email }).toArray();

        if (!clubs.length) {
            return res.send({
                message: "No clubs found for this manager",
                clubs: [],
                members: []
            });
        }

        const clubIds = clubs.map(club => club._id); // ObjectId array

       
        const memberships = await memberShipCollection.find({
            clubId: { $in: clubIds }
        }).toArray();

        if (!memberships.length) {
            return res.send({
                message: "No members found",
                clubs,
                members: []
            });
        }

        const userIds = memberships.map(m => m.userId);

        
        const users = await usersCollection.find({
            _id: { $in: userIds }
        }).toArray();

        // 4️⃣ Merge user + membership
        const membersWithDetails = memberships.map(m => {
            const user = users.find(u => u._id.toString() === m.userId.toString());
            return {
                ...m,
                user
            };
        });

        res.send({
            clubs,
            totalMembers: membersWithDetails.length,
            members: membersWithDetails
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error", error });
    }
});





    // clubs related api ----------------------- 

    //  +++++++++++++--------------- 
    app.post('/clubs', async(req, res)=>{
      let clubData = req.body;
      clubData.status = "pending";
      clubData.createdAt = new Date();
      clubData.updatedAt = new Date();

      let result = await clubsCollection.insertOne(clubData);
      res.send(result)
    })

    // ClubCards++++++++++++++++ 
    app.get('/allClubs', async(req, res)=>{
      let limit = parseInt(req.query.limit);
      let query = {status: "approved"} 
      let cursor =  clubsCollection.find(query).sort({createdAt: -1});

      if(limit){
        cursor = cursor.limit(limit);
      }

      let result = await cursor.toArray();
      res.send(result)
    })

  


    // clubDetails++++++++++++++++++++++ 
    app.get('/allClubs/:id', async(req, res)=>{
      let id = req.params.id;
      let query = {_id :new ObjectId(id)};
      let result = await clubsCollection.findOne(query);
      res.send(result)
    })


    // update clubs ----------------------------
    // UPDATE club
app.patch('/clubs/:id', async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  const query = { _id: new ObjectId(id) };

  const updateDoc = {
    $set: {
      clubName: updatedData.clubName,
      description: updatedData.description,
      category: updatedData.category,
      location: updatedData.location,
      bannerImage: updatedData.bannerImage,
      membershipFee: updatedData.membershipFee,
      updatedAt: new Date()
    }
  };

  const result = await clubsCollection.updateOne(query, updateDoc);
  res.send(result);
});




    // membership related api-------------------------- 

    // clubDetails++++++++++++++++++++++
app.post('/memberShip', async (req, res) => {
    try {
        const { userEmail, userName, clubId, membershipFee,clubName, joinedAt, expireAt } = req.body;

        // Find user
        const userData = await usersCollection.findOne({ email: userEmail });

        if (!userData) {
            return res.status(404).send({ message: "User not found", status: "no_user" });
        }

        const userId = userData._id;
        // console.log(userId);
        // console.log(clubId);

        //  existing membership
        const existingMembership = await memberShipCollection.findOne({
            userId: userId,
            clubId: new ObjectId(clubId)
        });

        if (existingMembership) {
            return res.send({
                message: "Already a member",
                status: existingMembership.status,
                membership: existingMembership
            });
        }

        // Status 
        let status = membershipFee == 0 ? "active" : "pending_payment";

        let membershipData = {
            userId,
            userEmail,
            userName,
            clubId:new ObjectId(clubId),
            membershipFee,
            clubName,
            joinedAt,
            expireAt,
            status
        };

        let result = await memberShipCollection.insertOne(membershipData);

        res.send({
          insertedId: result.insertedId,
          status,
          membership: membershipData
        })

    } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Server error" });
    }
});



 // clubDetails++++++++++++++++++++++
app.get("/memberShip/user/:email/club/:clubId", async (req, res) => {
    const { email, clubId } = req.params;

    const user = await usersCollection.findOne({ email });

    if (!user) return res.send(null);

    const membership = await memberShipCollection.findOne({
        userId: user._id,
        clubId: new ObjectId(clubId)
    });

    res.send(membership);
});





    // AllAdminClubs++++++++++++++++ 
        app.get('/allAdminClubs', async(req, res)=>{
      let query = {} 
      let cursor =  clubsCollection.find(query);
      let result = await cursor.toArray();
      res.send(result)
    })



    // AllAdminClubs++++++++++++++++ 
     app.patch('/allAdminClubs/:id', async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: status,
                    
                }
            }

            const result = await clubsCollection.updateOne(query, updatedDoc);

            if (status === 'approved') {
                const email = req.body.email;
                const userQuery = { email }
                const updateUser = {
                    $set: {
                        role: 'clubManager'
                    }
                }
                const userResult = await usersCollection.updateOne(userQuery, updateUser);
            }

            res.send(result);
        })






        // payment related apis----------------------
        
        // clubDetails jsx to payment jsx+++++++++++++++++ 
        app.get('/payment/:membershipId', async(req,res)=>{
          let membershipId = req.params.membershipId;
          let query = {_id : new ObjectId(membershipId)}
          let result = await memberShipCollection.findOne(query)
          res.send(result)
        })

        // Payment +++++++++++++++++++  
      app.post('/payment-checkout-session', async(req, res)=>{
      const { membershipId, membershipFee, userEmail,clubName } = req.body;

      let amount = Number(membershipFee) * 100;

       const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        
        price_data: {
          currency: 'USD',
          unit_amount: amount,
          product_data:{
            name: clubName,
          }
        },
        
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata:{
      membershipId: membershipId,
      clubName: clubName
    },
    customer_email: userEmail,
    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-canceled`,
  });
     console.log(session);
     res.send({url: session.url});

    })



    // paymentSuccess+++++++++++ 

    app.patch('/payment-success', async(req,res)=>{

      let sessionId = req.query.session_id;
      // console.log('session id ', sessionId);

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('session retrive', session);

      let transactionId = session.payment_intent;
      let query = {transactionId: transactionId};

      let paymentExist = await paymentCollection.findOne(query);

      if(paymentExist){
        return res.send({
          message: 'already exist', 
          transactionId,
          })
      }

      

      if(session.payment_status === 'paid'){
        let id = session.metadata.membershipId;
        let query = {_id: new ObjectId(id)};
        let update ={
          $set: {
              status: 'active',
              
          }
        }

        let result = await memberShipCollection.updateOne(query, update);

        let payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          userEmail: session.userEmail,
          membershipId: session.metadata.membershipId,
          clubName: session.metadata.clubName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          
        }

        if (session.payment_status === 'paid' ){
            let resultPayment = await paymentCollection.insertOne(payment); 
            res.send({success: true, 
              
               transactionId: session.payment_intent,
              
              payment: resultPayment});
        }

        
      }
      
      res.send({success: false});

    })





    // club member related api ------------------------------

    // SelfClubs++++++++++++++++++++++++ 
      app.get('/selfClubs', async(req, res)=>{
        let email = req.query.email
        let query = {managerEmail : email} 
        let cursor =  clubsCollection.find(query);
        let result = await cursor.toArray();
        res.send(result)
    })


    app.post('/createEvents', async(req, res)=>{
      let eventData = req.body;
      if (eventData.clubId) {
          eventData.clubId = new ObjectId(eventData.clubId);
  }
      eventData.createdAt = new Date();
      let result = await eventCollection.insertOne(eventData);
      res.send(result)

    })


    // event related api ------------------------------------

    // ShowAllEvents+++++++++++++++ 
    app.get('/showAllEvents', async(req,res)=>{
      let limit = parseInt(req.query.limit);
      let query = {};
      let cursor = eventCollection.find(query).sort({eventDate: 1});

      if(limit){
        cursor = cursor.limit(limit);
      }

      let result = await cursor.toArray();
      res.send(result)
    })



    //SingleEventDetails
 app.get('/singleEventDetails/:id', async(req,res)=>{
      let id = req.params.id;
      let query = {_id : new ObjectId(id)};
      let result =await eventCollection.findOne(query);
      
      res.send(result)
    })



    // Get Events for Manager ------------ 
    // SelfEventList++++++++++++++++++++ 
    app.get('/manager/events/:email', async (req, res) => {
    try {
        const email = req.params.email;

        const clubs = await clubsCollection.find({ managerEmail: email }).toArray();
        const clubIds = clubs.map(c => new ObjectId(c._id));

        const events = await eventCollection.find({
            clubId: { $in: clubIds }
        }).toArray();

        res.send(events);

    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false });
    }
});


app.delete('/event/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const result = await eventCollection.deleteOne({
            _id: new ObjectId(id)
        });

        res.send({ success: true, result });

    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false });
    }
});




// manager self events Update --------------------------- 
// SelfEventList++++++++++++++++++   UpdateEventModal+++++ 
app.patch('/event/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Only accept these fields for update
        const allowedFields = [
            "title",
            "description",
            "eventDate",
            "location",
            "isPaid",
            "eventFee",
            "maxAttendees"
        ];

        const updateData = {};

        // Only copy allowed fields
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Convert isPaid string -> boolean
        if (updateData.isPaid === "true") updateData.isPaid = true;
        if (updateData.isPaid === "false") updateData.isPaid = false;

        // Convert numbers
        if (updateData.eventFee !== undefined)
            updateData.eventFee = Number(updateData.eventFee);

        if (updateData.maxAttendees !== undefined)
            updateData.maxAttendees = Number(updateData.maxAttendees);

        const result = await eventCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        res.send({ success: true, result });

    } catch (error) {
        console.log("UPDATE ERROR:", error);
        res.status(500).send({ success: false, message: error.message });
    }
});








    // registeres events related apis -----------------------
    // SingleEventDetails+++++ to save mongodb +++++++ 
    app.post('/eventRegister', async(req, res)=>{

      let eventRegisterData = req.body;
      const { userEmail, eventId } = eventRegisterData;
      eventRegisterData.status = "registered";
      eventRegisterData.registeredAt = new Date();

      const existingRegister = await eventRegisterCollection.findOne({
            userEmail: userEmail,
            eventId: eventId
        });

        if (existingRegister) {
            return res.send({
                message: "Already registered",
                status: existingRegister.status,
                // membership: existingMembership
            });
        }

      let result = await eventRegisterCollection.insertOne(eventRegisterData);
      res.send(result)
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
