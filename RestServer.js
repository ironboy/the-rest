const fs = require('fs');
const path = require('path');
let express;

class RestServer {

  constructor(apiRoute, folderWithMongooseModels, acl) {
    this.apiRoute = apiRoute;
    this.app = express();
    this.app.use(express.json());
    this.modelFolder = folderWithMongooseModels;
    this.acl = acl || (() => { });
    this.start();
  }

  async start() {
    await this.hashModels(this.modelFolder);
    this.writeFrontendClassesFile();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.get('/:entity', (...x) => this.get(...x));
    this.app.get('/:entity/:query', (...x) => this.get(...x));
    this.app.post('/:entity', (...x) => this.post(...x));
    this.app.put('/:entity/:_id', (...x) => this.put(...x));
    this.app.delete('/:entity/:_id', (...x) => this.delete(...x));
  }

  async get(req, res) {
    let [model, query, extras] = await this.getModelAndQuery(req, res);
    if (!model) { return; }
    // perform the query
    let result = model.find(query);
    // if select is not specified then omit __v
    extras.select = extras.select || '-__v';
    // go through extra method calls (sort, populate etc)
    for (let method in extras) {
      let args = extras[method];
      args = args instanceof Array ? args : [args];
      if (!result[method]) { continue; }
      result = result[method](...args);
    }
    // wait for result, then send it
    result = await result.exec();
    res.json(result);
  }

  async post(req, res) {
    let [model] = await this.getModelAndQuery(req, res);
    if (!model) { return; }
    if (req.body instanceof Array) {
      this.multiSave(model, req, res);
      return;
    }
    let instance;
    try {
      instance = new model(req.body);
      await instance.save();
    }
    catch (e) {
      res.status(500);
      res.json({ error: e + '' });
      return;
    }
    res.json(instance);
  }

  async put(req, res) {
    let [model] = await this.getModelAndQuery(req, res);
    if (!model) { return; }
    // Find the instance
    let instance = await model.find({ _id: req.params._id });
    // Update the instance and save it
    try {
      Object.assign(instance[0], req.body);
      await instance[0].save();
    }
    catch (e) {
      res.status(500);
      res.json({ error: e + '' });
      return;
    }
    res.json(instance);
  }

  async delete(req, res) {
    let [model] = await this.getModelAndQuery(req, res);
    if (!model) { return; }
    // Delete the instance
    let result;
    let ids = (req.params._id || '').split('&');
    try {
      result = await model.deleteMany({ _id: { $in: ids } });
    }
    catch (e) {
      res.status(500);
      res.json({ error: e + '' });
      return;
    }
    res.json(result);
  }

  async hashModels(modelFolder) {
    // convert array of mongoose models to hash map
    // REST path => model
    let modelArray = await this.readModelsFromFolder(modelFolder);
    this.models = {};
    for (let model of modelArray) {
      this.models[model.collection.collectionName] = model;
    }
  }

  backToRegEx(val) {
    // convert back to reg ex from stringified reg ex
    return new RegExp(
      val.replace(/\w*$/, '').replace(/^\/(.*)\/$/, '$1'),
      val.match(/\w*$/)[0]
    );
  }

  async getModelAndQuery(req, res) {
    // parse a request - find the mongoose model
    // and parse the query
    let model = this.models[req.params.entity];
    let q = decodeURIComponent(req.params.query || '{}');
    q = q.includes('{') ? q : `{"_id": "${q}"}`;
    let query = JSON.parse(q, (key, val) => {
      return key === '$regex' ? this.backToRegEx(val) : val;
    });
    // extras - extra methods to call besides find (sort, populate etc)
    let extras = query.___ || {};
    delete query.___;
    if (!model) {
      res.status(404);
      res.json({ error: 'No such model!' });
    }
    let aclResult = await this.acl({
      route: req.params.entity,
      requestMethod: req.method,
      modelName: model.modelName,
      model: model,
      query: query,
      extras: extras
    }, req);
    if (aclResult) {
      res.json({ $acl: aclResult });
      return [];
    }
    return [model, query, extras];
  }

  async multiSave(model, req, res) {
    // create or update multiple items
    // when the frontend calls save on an array of items
    let existing = req.body.filter(item => item._id);
    let ids = existing.map(item => item._id);
    let nonExisting = req.body.filter(item => !item._id);
    // fetch the items that already exists
    let toUpdate = await model.find({ _id: { $in: ids } });
    // demand that all items with _ids should exist in db
    if (existing.length !== toUpdate.length) {
      res.status(500);
      res.json({ error: 'Could not find all _ids!' });
      return;
    }
    // create a hash map of toUpdate
    let toUpdateHash = {};
    for (let item of toUpdate) {
      toUpdateHash[item._id] = item;
    }
    // create and or update every item
    let result = [];
    try {
      for (let item of req.body) {
        let obj = toUpdateHash[item._id] || new model(item);
        toUpdateHash[item._id] && Object.assign(obj, item);
        await obj.save();
        result.push(obj);
      }
    }
    catch (e) {
      res.status(500);
      res.json({ error: e + '' });
      return;
    }
    res.json(result);
  }

  async readModelsFromFolder(folderPath) {
    let filePaths = await this.getFileNames(folderPath);
    let models = [];
    for (let file of filePaths) {
      try {
        let model = require(file);
        model.collection.collectionName && models.push(model);
      }
      catch (e) {
        console.log('The file ' + file + ' does not contain a valid Mongoose model!');
      }
    }
    return models;
  }

  getFileNames(folderPath) {
    // read a folder recursively looking for js files
    let fs = require('fs');
    let base = { __count: 0, arr: [] };
    if (!fs.existsSync(folderPath)) { return []; }
    recursiveReadDir(folderPath);
    let resolve;
    let callback = x => resolve(x);
    return new Promise((res) => {
      resolve = res;
    });
    // recursor
    function recursiveReadDir(folderPath) {
      base.__count++;
      fs.readdir(folderPath, function (err, x) {
        base.__count--;
        for (let j = 0; j < x.length; j++) {
          let i = x[j];
          if (i.indexOf(".") < 0 && !err) {
            recursiveReadDir(path.join(folderPath, i), callback);
          }
          else if (i.indexOf(".js") > 0) {
            base.arr.push(path.join(folderPath, i));
          }
        }
        if (base.__count === 0) { callback(base.arr); }
      });
    }
  }

  writeFrontendClassesFile() {
    let pathToCode = path.join(__dirname, 'dist', 'to-import.js');
    let pathToScript = path.join(__dirname, 'dist', 'as-script.js');
    let scriptCode = fs.readFileSync(path.join(__dirname, 'RestClientArray.js'), 'utf-8');
    scriptCode += '\n\n' + fs.readFileSync(path.join(__dirname, 'RestClient.js'), 'utf-8');
    let named = '';
    let code = `
      const _ = {
    `;
    for (let route in this.models) {
      let modelName = this.models[route].modelName;
      code += `
        ${modelName}: class ${modelName} extends RestClient {
          static get route(){
            return '${this.apiRoute}/${route}';
          }
          static get array(){
            let _class = this;
            this._arrayClass = this._arrayClass || class ${modelName}Array extends RestClientArray {
              static get _class() {
                return _class;
              }
            }
            return this._arrayClass;
          }
        },
      `;
      named += `export const ${modelName} = _.${modelName};\n`;
    }
    code += '\n}\n\n';
    let last = code.lastIndexOf(',');
    code = code.substring(0, last) + code.substring(last + 1);
    code = code.split('\n');
    code.shift();
    let ws = code[0].match(/^\s*/)[0];
    code = code.map(x => x.replace(ws, ''));
    code = scriptCode + '\n\n' + code.join('\n');
    let script = code.replace(/const _ = /, 'window.REST = ');
    code += named + '\nexport default _;';
    script = script.split('\n');
    script = script.map(x => '  ' + x).join('\n');
    script = '(function(){\n\n' + script + '\n})();'
    let oldCode = fs.existsSync(pathToCode) && fs.readFileSync(pathToCode, 'utf-8');
    oldCode !== code && fs.writeFileSync(pathToCode, code, 'utf-8');
    let oldScript = fs.existsSync(pathToScript) && fs.readFileSync(pathToScript, 'utf-8');
    oldScript !== script && fs.writeFileSync(pathToScript, script, 'utf-8');
  }

}

// Return Express middleware
module.exports = function (_express, apiRoute, folderWithMongooseModels, acl) {
  let express = _express;
  if(typeof express !== 'function'){
    throw(new Error(
      'Starting with version 1.0.17 of the.rest you need ' + 
      'to provide the express module as the first argument to the the.rest!'
    ));
  }
  apiRoute = apiRoute.replace(/\/*$/, '');
  let server = new RestServer(apiRoute, folderWithMongooseModels, acl);
  let pathToScript = path.join(__dirname, 'dist', 'as-script.js');
  let first = true;
  return (req, res, next) => {
    // add the REST server as a sub app to the app
    first && res.app.use(apiRoute, server.app);
    first && res.app.get('/REST.js', (req, res) => {
      res.sendFile(pathToScript);
    });
    first = false;
    next();
  }
}
