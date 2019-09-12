class RestClient {

  constructor(properties) {
    Object.assign(this, properties);
  }

  static get array() {
    return RestClientArray;
  }

  static baseUrlCalc(_class = this){
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

  static async find(query = {}, methods = {}) {
    query = typeof query === 'object' ? query : { _id: query };
    query.___ = methods;
    query = this.stringifyAndPreserveRegExps(query);
    let raw = await fetch(this.baseUrl + encodeURIComponent(query));
    let array = await raw.json();
    array = array.map(item => new this(item));
    return new RestClientArray(...array);
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
    Object.assign(this, response);
  }

  async delete() {
    let raw = await fetch(this.baseUrl + (this._id || ''), {
      method: 'DELETE'
    });
    return await raw.json();
  }

}