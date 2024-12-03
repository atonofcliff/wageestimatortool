export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Wage data (embedded directly in the worker)
    const WAGE_DATA = {
      'US': {
        'California': {
          'San Francisco': 45.50,
          'San Jose': 44.75,
          'Los Angeles': 38.25
        },
        'Texas': {
          'Austin': 37.50,
          'Dallas': 36.75,
          'Houston': 35.90
        },
        'Virginia': {
          'Northern VA': 42.00,
          'Ashburn': 41.50
        },
        'Oregon': {
          'Portland': 39.25
        },
        'Washington': {
          'Seattle': 43.75
        }
      },
      'CA': {
        'Ontario': {
          'Toronto': 35.60,
          'Montreal': 34.25
        }
      },
      'EU': {
        'Germany': {
          'Frankfurt': 35.20,
          'Berlin': 33.75
        },
        'Netherlands': {
          'Amsterdam': 36.50
        },
        'UK': {
          'London': 38.90,
          'Manchester': 35.40
        }
      }
    };

    // Wage lookup function
    function findWage(location) {
      const parts = location.split(',').map(part => part.trim());
      
      for (let country in WAGE_DATA) {
        for (let state in WAGE_DATA[country]) {
          for (let city in WAGE_DATA[country][state]) {
            if (city.toLowerCase() === parts[0].toLowerCase()) {
              return WAGE_DATA[country][state][city];
            }
          }
          
          if (state.toLowerCase() === parts[0].toLowerCase()) {
            const wages = Object.values(WAGE_DATA[country][state]);
            return wages.reduce((a, b) => a + b, 0) / wages.length;
          }
        }
        
        if (country.toLowerCase() === parts[0].toLowerCase()) {
          const countryWages = Object.values(WAGE_DATA[country])
            .flatMap(state => Object.values(state));
          return countryWages.reduce((a, b) => a + b, 0) / countryWages.length;
        }
      }
      
      return null;
    }

    // Handle API requests
    if (url.pathname === '/api/wage') {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        let location = '';
        if (request.method === 'GET') {
          location = url.searchParams.get('location') || '';
        } else if (request.method === 'POST') {
          const body = await request.json();
          location = body.location || '';
        }

        location = location.trim();
        if (!location) {
          return new Response(JSON.stringify({
            error: 'Location is required',
            message: 'Please provide a specific city, state/province, or country'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const wage = findWage(location);

        if (wage !== null) {
          return new Response(JSON.stringify({
            location: location,
            hourlyWage: wage,
            currency: 'USD'
          }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } else {
          return new Response(JSON.stringify({
            error: 'Location not found',
            message: `No wage data available for ${location}. Try a different location or level of detail.`
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Internal Server Error',
          message: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // Serve HTML for root path
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Data Center Contractor Wage Estimator</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          input, button {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
          }
          #result {
            margin-top: 20px;
            padding: 15px;
            background-color: #f4f4f4;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Data Center Contractor Wage Estimator</h1>
        <input type="text" id="locationInput" placeholder="Enter location (e.g., San Francisco, Austin)">
        <button onclick="estimateWage()">Estimate Wage</button>
        <div id="result"></div>

        <script>
          async function estimateWage() {
            const location = document.getElementById('locationInput').value;
            const resultDiv = document.getElementById('result');

            try {
              const response = await fetch('/api/wage?location=' + encodeURIComponent(location), {
                method: 'GET'
              });

              const data = await response.json();

              if (data.hourlyWage) {
                resultDiv.innerHTML = \`
                  <strong>Location:</strong> \${data.location}<br>
                  <strong>Hourly Wage:</strong> $\${data.hourlyWage.toFixed(2)} \${data.currency}
                \`;
                resultDiv.style.color = 'green';
              } else {
                resultDiv.innerHTML = data.message;
                resultDiv.style.color = 'red';
              }
            } catch (error) {
              resultDiv.innerHTML = 'Error fetching wage data';
              resultDiv.style.color = 'red';
            }
          }
        </script>
      </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
};
