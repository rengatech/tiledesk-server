FROM node:20.15

# Install system dependencies for sharp
RUN apt-get update && apt-get install -y \
    gcc g++ make \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Create app directory
WORKDIR /usr/src/app

# Argument for NPM_TOKEN
ARG NPM_TOKEN

# If NPM_TOKEN is provided, create .npmrc file for private npm registry authentication
RUN if [ -n "$NPM_TOKEN" ]; then \
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc; \
    fi

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Remove the .npmrc file after installation (if created)
RUN rm -f .npmrc

# Copy the rest of the application source
COPY . .

# Expose the app's port
EXPOSE 3000

# Start the app
CMD [ "npm", "start" ]
