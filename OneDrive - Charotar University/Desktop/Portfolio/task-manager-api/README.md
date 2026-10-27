# Task Manager API Practical - Drashti Patel

This project implements Practicals 4-5 from Advanced Web Development Frameworks / IBM Node.js and MongoDB learning.

## Owner Info

- Name: Drashti Patel
- University: CSPIT, CHARUSAT University
- GitHub: https://github.com/drashti8175
- LinkedIn: https://www.linkedin.com/in/drashti-patel-31ba52333/

## Included Requirements

- Express server
- JSON parsing middleware
- Request logging middleware with method, URL, and timestamp
- JSON content-type validation for POST/PUT
- CRUD routes for `/tasks`
- Route-specific ObjectId validation middleware
- Custom 404 JSON handler
- Global error handling middleware defined last
- MongoDB connection through Mongoose
- Task schema with `title`, `description`, `completed`, `priority`, and `createdAt`
- Required field validation, enum validation, and defaults
- `.env.example` provided and `.env` ignored

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Edit `.env` and set `MONGO_URI` before running.

## Test Endpoints

```http
GET    /tasks
GET    /tasks/:id
POST   /tasks
PUT    /tasks/:id
DELETE /tasks/:id
```

Example POST body:

```json
{
  "title": "Complete React practical",
  "description": "Build reusable components, routes, and GitHub API page",
  "priority": "high"
}
```
