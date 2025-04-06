# METAWATT

METAWATT is a demonstration application showcasing how to tokenize and manage Renewable Energy Certificates (RECs) on Bitcoin SV. It leverages the MetaNet Client to securely create, purchase, and claim certificates on-chain, illustrating a transparent way to verify renewable energy usage.

## Standard BSV Project Structure
Below is a general overview of a typical BSV project layout and workflow. METAWATT adapts this structure by integrating a React-based frontend, a Bitcoin SV backend, and the MetaNet Client for transaction signing and encryption.

## Helpful Links
LARS (for local development)
https://github.com/bitcoin-sv/lars

MetaNet Client Repository
https://github.com/p2ppsr/metanet-desktop

Todo.ts
https://github.com/p2ppsr/todo-ts


## Getting Started
Clone this repository:

git clone https://github.com/bsvhackathon/METAWATT.git
cd METAWATT
Install dependencies:

npm i
Local environment (optional advanced usage with LARS):

npm run lars
Configure your local environment as needed for development.

Start developing:

npm run start
This spins up the application. Navigate to http://localhost:3000 to access METAWATT’s UI.

Build and deploy (CARS workflow):

When ready to publish, first run:

npm run cars
Configure one or more hosting providers for your project.

Build artifacts with:

npm run build
Deploy using:

npm run deploy
You can view logs, set up custom domains, or manage payments via your hosting providers’ portals or via cars commands.

Share your project once deployed, and invite others to try your on-chain solution!

###

frontend/
Contains the React application (e.g., App.tsx, charts, and UI logic).

backend/
Houses server-side or BSV logic, including contract interactions and scripts.

Feel free to adapt the layout to fit your specific use case.

### License
This project is made available under the Open BSV License. The license encourages innovation on Bitcoin SV while ensuring new developments remain open and interoperable.
