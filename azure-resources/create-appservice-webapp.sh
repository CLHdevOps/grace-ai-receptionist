az appservice plan create \
  -n asp-grace-receptionist \
  -g rg-grace-receptionist \
  --sku B1 \
  --is-linux

az webapp create \
  -n grace-receptionist-app \
  -g rg-grace-receptionist \
  --plan asp-grace-receptionist \
  --runtime "NODE:20-lts"
