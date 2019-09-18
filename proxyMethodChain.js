const proxyMethodChain = (() => {
  
    let mem = {}, propMem, callback;
  
    function getty(target, prop) {
      if (prop === 'then') {
        return callback(mem);
      }
      else {
        propMem = prop;
        return proxyMethodChain(func);
      }
    }
  
    function func(...args) {
      mem[propMem] = args.length === 1 ? args[0] : args;
      return proxyMethodChain(func);
    }
  
    function proxyMethodChain(obj = {}, cb) {
      callback = cb || callback;
      mem = cb ? {} : mem;
      return new Proxy(obj, { get: getty });
    }

    return proxyMethodChain;
  
  })();