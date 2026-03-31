**CityScape 🌳**
Turning raw urban data into actionable greenspace decisions
CityScape is an AI-assisted urban planning platform that helps cities visualize, analyze, and act on greenspace opportunities — before a single tree is planted.

Inspiration
Cities are getting hotter. Urban heat islands, shrinking greenspace, and outdated planning tools are making it harder for city planners to make informed, data-driven decisions about their urban environment.
Yet the data already exists.
CityScape was built to bridge that gap — taking raw spatial and environmental datasets and transforming them into an interactive, 3D planning environment where the impact of a decision is visible before it's made. Whether you're a civil engineer, a sustainability researcher, or a city planner, understanding your city's greenspace should be intuitive, not buried in spreadsheets.

What It Does
CityScape analyzes urban surfaces and surfaces actionable insights across multiple dimensions:

Greenspace analysis

Identify optimal locations for new tree planting
Visualize existing greenspace coverage and gaps


Environmental impact estimation

Carbon absorption metrics per proposed change
Urban heat island identification via heatmap overlays


3D urban visualization

Interactive Mapbox GL JS map with real building geometry
Proposed changes rendered directly onto the city in 3D


AI-assisted planning interface

Explore data and proposed changes through a conversational planning layer




How We Built It
Frontend

Next.js, React, TypeScript
Mapbox GL JS — 3D building rendering, geospatial visualization, heatmap & routing layers
Tailwind CSS

Infrastructure

Vercel — deployment and hosting

Data

Raw spatial and public urban datasets
Coordinate system alignment and geospatial data processing


Getting Started
1. Clone the repository
bashgit clone https://github.com/tanvibatchu/CityScapes.git
cd CityScapes/frontend
2. Install dependencies
bashnpm install
3. Set up environment variables
bashcp .env.example .env
Fill in required values (Mapbox API token, etc.)
4. Run the development server
bashnpm run dev
Open http://localhost:3000 to view the app.

Challenges
Integrating multiple spatial datasets and handling coordinate systems within Mapbox required very careful debugging — getting everything to align correctly in 3D was one of the hardest and most rewarding parts of the build. We also navigated plenty of merge conflicts along the way.

Accomplishments
For several of us, this was our first time using Claude Code — and we went from idea to working product in a very short amount of time. We learned a ton about Mapbox, 3D building rendering, and how to turn raw public data into a clean, user-friendly design.

What's Next

Validate with real planners — we've already spoken with civil engineers in the Kitchener–Waterloo region who confirmed the tool's potential, and we plan to expand those conversations with city planners and sustainability researchers
Improve rendering and visuals — refining 3D map visuals, greenspace overlays, and interface clarity so insights are accessible to both technical experts and everyday users
Deepen environmental modeling — expanding the range of impact metrics beyond carbon absorption


About
CityScape is an AI-assisted urban planning platform that transforms complex geospatial and environmental data into an interactive 3D map environment — making greenspace planning intuitive, visual, and actionable for the people who design our cities.
