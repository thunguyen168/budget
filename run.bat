   @echo off
   cd C:\Users\hathu\Documents\GitHub\budget
   set NODE_ENV=development
   start cmd /k "npx vite"
   timeout /t 5
   npx electron .