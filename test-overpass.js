async function test() {
  const query = `
    [out:json][timeout:25];
    (
      relation["admin_level"~"9|10"](41.38,2.16,41.40,2.18);
      relation["place"~"neighbourhood|suburb"](41.38,2.16,41.40,2.18);
    );
    out geom;
  `;
  const url = 'https://rotas-overpass-proxy.icaro-mh.workers.dev/api/interpreter';
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Origin': 'http://localhost:5173' }
    });
    const data = await res.json();
    if (data.elements.length > 0) {
      console.log('Sample member 0:', JSON.stringify(data.elements[0].members[0]).substring(0, 150));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
