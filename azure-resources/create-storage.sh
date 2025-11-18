az storage account create \
  -n <yourstorageacctname> \
  -g rg-grace-receptionist \
  -l eastus \
  --sku Standard_LRS

az storage container create \
  --account-name <yourstorageacctname> \
  --name calls \
  --auth-mode login
