# the.rest
A flexible REST backend with an ORM like frontend for Mongoose, working well in React.

**the.rest** sets up all REST routes automatically and corresponding frontend classes that consume them but looks like normal classes to you.

## Installation

This module is meant to be used together with **Express** and **Mongoose** so if you haven't done so already:
```
npm install express
npm install mongoose
```

Then:
```
npm install 'the.rest'
```

## Backend setup
Here is an example of fairly typical backend setup

### index.js

```js
// Modules
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const RESTserver = require('the.rest');

// Connect to MongoDB via Mongoose
mongoose.connect('mongodb://localhost/db-name', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;

// Create an Express server
const app = express();

// ..and install the.rest as middleware
// you need to tell it two things:
// 1) the base route to its api
// 2) the path to a folder with mongoose-models 
//    Please Note: The path must be absolute
const pathToModelFolder = path.join(__dirname, 'mongoose-models');
app.use(RESTserver('/api', pathToModelFolder));

// Add other middleware you might need (express.static etc)

// Listen on port 5000
app.listen(5000, () => console.log('Listening on port 5000'));
```

### Create the folder mongoose-models
Create a folder named **mongoose-models** and a file for each mongoose model. Each file should export a mongoose model. It should look something like this:

```js
const mongoose = require('mongoose');

const modelName = 'Cat';
const schema = {
    name: String
};

module.exports = mongoose.model(modelName, schema);
```

### If in a React/Vue etc. development environement - make proxy settings for yor node server

React: [Proxying API Requests in development ](https://create-react-app.dev/docs/proxying-api-requests-in-development)

Vue: [Devserver proxy](https://cli.vuejs.org/config/#devserver-proxy)


## Frontend setup

### Old style script include
If you are using plaing old JavaScript (no import-statements/build environments) you can include the frontend part of **the.rest** like this:

```html
<script src="/REST.js">
```
You will now have a global object called **REST**. Each Mongoose.model will be available as a property - so if you have created a model called **Cat** and a model called **Dog**, their frontend equivalents would be available as **REST.Cat**, **REST.Dog** etc.

If you want individual variables just use a destructuring assignment:

```js
const {Cat, Dog} = REST;
```

### Using import
If you are in an environment where you import dependencies using **import** do:

```js
import REST from 'the.rest/dist/to-import';
```

Each Mongoose.model will be available as a property - so if you have created a model called **Cat** and a model called **Dog**, their frontend equivalents would be available as **REST.Cat**, **REST.Dog** etc.

#### Named imports
You can also use named imports:

```js
import {Cat, Dog} from 'the.rest/dist/to-import';
```

### Usage
**the.rest** makes it really easy to *find*, *save* and *delete* Mongoose instance from your frontend code.

The API is optimized to be used together with **await** (inside **async** functions).

### Creating things
Creating and saving new instance are simple:

```js
// Create a new cat
let g = new Cat({name: 'Garfield'});
// save it to the db  (the properrty _id is also added)
await g.save();
```


### Finding things

#### All instances
Find all Cats:

```js
let c = await Cat.find()
```

#### A single one

```js
let c = await Cat.findOne({_id: '5d793d86d3af842b4f92121c'});
```

Shorthand for find by id is:

```js
let theCat = await Cat.findOne('5d793d86d3af842b4f92121c');
```

#### Any type of query
Any query you can use with Mongo/Mongoose can be used:

```js
// Fin all cats starting with 'gar' in their name
let cats = await Cat.find({name:/gar/i});
```

#### Use any of the extra methods in Mongoose queries
Mongoose has a lot of [extra methods](https://mongoosejs.com/docs/api/query.html) for controlling queries (select, sort, limit, populate etc).

Most of them will work from the frontend with **the.rest**. However the syntax is slighly differentm, but in an easy to learn way.

A typical example of Mongoose syntax (backend):

```js
await Cat.find({}).sort('name').limit(10).select('name');
```

The same thing wtitten in **the.rest** syntax on the frontend:

```js
await Cat.find({}, {sort: 'name', limit: 10, select: 'name'});
```

### Updating things
You use **save** for updates as well as for creation.

```js
let theCat = await Cat.findOne('5d793d86d3af842b4f92121c');
theCat.name += ' Supercat';
await theCat.save();
```

### Deleting things

```js
let theExCat = await Cat.findOne('5d793d86d3af842b4f92121c');
await theCat.delete();
```

### Saving many things at once
**The.rest** uses a special array subclass called **RESTRestClientArray** that have the methods **save** and **delete** - and lets you save/update/delete several instances at once.

#### Create some new cats
```js
// Create the cats
let cats = new Cat.array(
  new Cat({name: 'A'}),
  new Cat({name: 'B'}),
  new Cat({name: 'C'})
);
// Save them all at once
await cats.save();
```

#### Update all cats at once
```js
// Find the cats
let cats = Cats.find();
// Update their names
cats.forEach(x => x.name += ' The Greatest');
// Save them all at once
await cats.save();
```

#### Delete many cats at once
```js
// Find the cats
let cats = Cats.find({name: /gar/i});
// Delete them all at once
await cats.delete();
```

### Adding methods to the classes
If you want a dog who can bark and sit you simply add the methods to the **Dog** class like this:

```js
Object.assign(Dog.prototype, {
  bark(){
    return `Woof! I am ${this.name}!`;
  },
  sit(){
    return `I, ${this.name}, am sitting. Give me candy!`;
  }
});
```

### Population
[Population with Mongoose](https://mongoosejs.com/docs/populate.html) is the equivalent of joins in SQL. When you use **the.rest** you can add the parameter **populateRevive** to revive populated fields as real **the.rest** frontend classes.

Given that we have the models **Elephant** and **Tiger** and *favoriteTiger: {type: mongoose.Schema.Types.ObjectId, ref: 'Tiger'}* in the *Elephant* schema:

```js
 // Delete all tigers and elephants
await (await Tiger.find()).delete();
await (await Elephant.find()).delete();

// Create a tiger
let tigger = new Tiger({ name: 'Tigger' });
await tigger.save();
console.log('tigger', tigger);

// Create an elephant that likes Tigger
let dumbo = new Elephant({ name: 'Dumbo', favoriteTiger: tigger});
await dumbo.save();
console.log('dumbo', dumbo);

// All elephants populated with tigers
let elephants = await Elephant.find({}, {
  populate: 'favoriteTiger', 
  populateRevive: Tiger
});

console.log('elephants', elephants);
```

**Note:** If you want to populate several fields, then *populate* should be a space delimited string and *populateRevive* an array of classes.