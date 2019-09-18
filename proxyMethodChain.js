class ProxyMethodChain {

  constructor(){
    this.mem = {};
  }

  create(callback) {
    this.callback = callback ? callback : this.callback;
    this.mem = callback ? {} : this.mem;
    return new Proxy((...x) => this.func(...x), { get: (...x) => this.getter(...x)});
  }

  getter(target, prop){
    if (prop === 'then') {
      return this.callback;
    }
    else {
      this.propMem = prop;
      return this.create();
    }
  }

  func(...args) {
    this.mem[this.propMem] = args.length === 1 ? args[0] : args;
    return this.create();
  }

}
