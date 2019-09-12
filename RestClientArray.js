class RestClientArray extends Array {

  async save() {
    // save every item in the array (create or update if it exists)
    if (this.length === 0) { return; }
    let raw = await fetch(this[0].baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this)
    });
    // update every item according to the response
    let response = await raw.json();
    let i = 0;
    for (let item of response) {
      Object.assign(this[i++], item);
    }
  }

  async delete() {
    // delete every item in the array
    if (this.length === 0) {
      return { deletedCount: 0, n: 0, ok: 1 }
    }
    let ids = this.map(item => item._id);
    console.log("THE", ids)
    let raw = await fetch(this[0].baseUrl + ids.join('&'), {
      method: 'DELETE'
    });
    this.length = 0;
    return await raw.json();
  }

}