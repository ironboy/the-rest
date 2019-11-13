class RestClient {

  constructor(properties) {
    Object.assign(this, properties);
  }

  static baseUrlCalc(_class = this) {
    let r = _class.route;
    r += r.substr(-1) === '/' ? '' : '/';
    return r;
  }

  static get baseUrl() {
    return this.baseUrlCalc();
  }

  get baseUrl() {
    return RestClient.baseUrlCalc(this.constructor);
  }

  static stringifyAndPreserveRegExps(data = {}) {
    // normal JSON.stringify doesn't preserve regular expressions
    // here we do, converting them to objects with the property regexp
    // and the regexp written as a string
    return JSON.stringify(data, (key, val) =>
      val.constructor === RegExp ?
        { $regex: val.toString() } : val
    );
  }

  static find(x, y) {
    if (y || typeof Proxy === "undefined") {
      return this.findTrad(x, y);
    }
    else {
      let pmc = new ProxyMethodChain();
      return pmc.create(async resolve => {
        resolve(await this._find(x, pmc.mem));
      });
    }
  }

  static async _find(query = {}, methods = {}) {
    query = typeof query === 'object' ? query : { _id: query };
    query.___ = methods;
    let popRevive = methods.populateRevive || [];
    popRevive = popRevive instanceof Array ? popRevive : [popRevive];
    delete methods.populateRevive;
    query = this.stringifyAndPreserveRegExps(query);
    let raw = await fetch(this.baseUrl + encodeURIComponent(query));
    let array = await raw.json();
    if (array.$acl) {
      typeof this.acl === 'function' && this.acl(array.$acl);
      return new this.array();
    }
    array = array.map(item => new this(item));
    if (methods.populate) {
      let fieldsToPopulate = typeof methods.populate === 'string' ? methods.populate.split(' ') : methods.populate;
      for (let item of array) {
        let i = 0;
        for (let popField of fieldsToPopulate) {
          let wasArray = item[popField] instanceof Array;
          let arr = [];
          for (let subitem of wasArray ? item[popField] : [item[popField]]) {
            arr.push(subitem && popRevive[i] ? new popRevive[i](subitem) : subitem);
          }
          arr = wasArray ? newRestClientArray(...arr) : arr[0];
          item[popField] = arr;
          i++;
        }
      }
    }
    return new this.array(...array);
  }

  static async findOne(...args) {
    return (await this.find(...args))[0];
  }

  async save() {
    let raw = await fetch(this.baseUrl + (this._id || ''), {
      // assume PUT if this._id exists
      method: this._id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this)
    });
    // update this with response
    let response = await raw.json();
    if (response.$acl) {
      typeof this.construcotr.acl === 'function' && this.constructor.acl(array.$acl);
      return;
    }
    Object.assign(this, response);
  }

  async delete() {
    let raw = await fetch(this.baseUrl + (this._id || ''), {
      method: 'DELETE'
    });
    let response = await raw.json();
    if (response.$acl) {
      typeof this.constructor.acl === 'function' && this.constructor.acl(array.$acl);
      return { deletedCount: 0, n: 0, ok: 1 };
    }
    return response;
  }

}