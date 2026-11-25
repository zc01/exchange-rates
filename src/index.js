
const BOI_API =
  "https://boi.org.il/PublicApi/GetExchangeRate?key=";

async function getRate(currency = "USD") {
  const seriesCodes = {
    USD: "RER_USD_ILS",
    EUR: "RER_EUR_ILS"
  };

  const seriesCode = seriesCodes[currency.toUpperCase()];

  if (!seriesCode) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  const url =
    "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/" +
    `?c%5BSERIES_CODE%5D=${seriesCode}` +
    "&lastNObservations=1&format=sdmx-json";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`BOI API error: ${response.status}`);
  }

  const data = await response.json();

  const series = Object.values(data.data.dataSets[0].series)[0];

  const rate = Number(series.observations["0"][0]);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid ${currency} exchange rate`);
  }

  return rate;
}

function formatIsraeliTime(timestamp) {
    // return new Intl.DateTimeFormat("en-GB", {
    //     timeZone: "Asia/Jerusalem",
    //     hour12: false,
    //     timeStyle: "short"
    // }).format(new Date(timestamp));
   return  new Date(timestamp).toLocaleString("en-GB", {
        timeZone: "Asia/Jerusalem",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}

async function getContinuousRate(currency = "USD") {
    const API_KEY = "exr_live_xqlcHQ23NGu-T2DTBnJJeRexSysLPfksK6xwrZUSskU";

    const url = `https://api.exchangerate.dev/v1/latest/${currency}?symbols=ILS`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${API_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.result !== "success") {
        throw new Error(data.message || data.code);
    }

    const rate = data.rates?.ILS;
    return rate;
    // const time = formatIsraeliTime(data.data_updated_at)

    // return {rate: rate, time: time};
}

// Helper: return a plain text number
function numberResponse(value) {
  return new Response(value, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function handleNotAvailable(rate){
  if (!rate){
    return "אינו זמין כרגע";
  }
  return `${rate} שקלים`;
}

function currencyWording(currency){
          console.log("currency.toUpperCase()", currency.toUpperCase())

  if(currency.toUpperCase() === "USD"){
          return "דולרים";
        }
        else{
          return "יורו";
        }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // 1. Get current USD rate
      if (url.pathname === "/rate") {
        const currency = url.searchParams.get("currency");
        var rate = undefined, continuousRate = undefined;
        try{
          rate = await getRate(currency);
        }
        catch(error){
          console.log("Error fetching rate: ",error);
          // return numberResponse(`השער היציג: ${rate} שקלים. השער הרציף: אינו זמין זמנית.`);
        }
        try{
          continuousRate = await getContinuousRate(currency);
          continuousRate = continuousRate.toFixed(4);
          // const time = data.time;
        }
        catch(error){
          console.log("Error fetching continous rate")
          // return numberResponse(`השער היציג: ${rate} שקלים. השער הרציף: אינו זמין זמנית.`);
        }

        rate = handleNotAvailable(rate);
        continuousRate = handleNotAvailable(continuousRate);
       
       return numberResponse(`השער היציג: ${rate}. השער הרציף: ${continuousRate}. `);
      }

      // 2. Convert NIS to USD
      if (url.pathname === "/nis-to-usd") {
        const amount = Number(url.searchParams.get("amount"));
        const currency = url.searchParams.get("currency") || "USD";

        if (!url.searchParams.has("amount") || !Number.isFinite(amount)) {
          return new Response("Invalid amount", { status: 400 });
        }

        const rate = await getRate(currency);
        const continuousRate = await getContinuousRate(currency);
        const result = amount / rate ;
        const result2 = amount / continuousRate;
        
        console.log("currency:", currency)

        return numberResponse(`${result.toFixed(2)} ${currencyWording(currency)} לפי השער היציג, ${result2.toFixed(2)} ${currencyWording(currency)} לפי השער הרציף`);
      }

      // 3. Convert USD to NIS
      if (url.pathname === "/usd-to-nis") {
        const amount = Number(url.searchParams.get("amount"));
        const currency = url.searchParams.get("currency") || "USD";


        if (!url.searchParams.has("amount") || !Number.isFinite(amount)) {
          return new Response("Invalid amount", { status: 400 });
        }

        const rate = await getRate(currency);
        const continuousRate = await getContinuousRate(currency);
        const result = amount * rate;
        const result2 = amount * continuousRate;

        return numberResponse(`${result.toFixed(2)} שקלים לפי השער היציג. ${result2.toFixed(2)} שקלים לפי השער הרציף.`);
      }

	  if (url.pathname === "/continuous-rate" && request.method === "GET") {
      try {
        const currency = url.searchParams.get("currency");
        const result = await getContinuousRate2(currency);
        
        return new Response(result, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=300"
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          code: error.code
        }), {
          status: 502,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
}

      return new Response("Not found", { status: 404 });

    } catch (error) {
      return new Response(
        "Exchange rate service unavailable",
        { status: 502 }
      );
    }
  }
};
