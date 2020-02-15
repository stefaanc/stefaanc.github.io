---
layout: post
title: "The Terraform Resource Lifecycle"
category: general
date: 2020-02-15 14:41:12 +0000
comments: true
---

I recently started working on Terraform Provider plugins, but there doesn't seem to be much information about plugin-development out there on the internet.  So I decided to collect some of my experience in a couple of posts.

The Terraform resource lifecycle is based on [the CRUD methods: Create, Read, Update and Delete](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete). The minimum set of methods a provider needs to implement for a resource is: `Create`, `Read` and `Delete`.  The `Update` method is optional.  And for resources where a `Read` is expensive, one can also add an `Exists` method.

<br/>

### The `Create`, `Read` & `Delete` Methods

These are the basic provider-methods used by Terraform.  Which methods Terraform executes to refresh its state and to apply the user's configuration depends on the state of the infrastructure, the state stored in the Terraform state-file ( typically `terraform.tfstate`) and the Terraform configuration-files (`*.tf`).

<br/>

resource                                                                     | &nbsp; | terraform refresh           | terraform apply
:----------------------------------------------------------------------------|--------|:----------------------------|:---------------------
 &nbsp;                           - not in infrastructure                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                         | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      1 | ---                         | Create, Read
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      2 | Read (clear state)          |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      3 | Read (clear state)          | Create, Read
 &nbsp;                           - in infrastructure                        | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                         | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      4 | ---                         | Create (error)
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      5 | Read (refresh state)        | Delete
 &nbsp; &emsp; &emsp;                  --- in terraform config               | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp;               > config same as state            |      6 | Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed computed attributes  |      7 | Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp;               > config different from state     | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed force-new attributes |      8 | Read (refresh state)        | Delete, Create, Read
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed common attributes    |      - | n.a.                        | n.a.

<br/>

For instance, take line 3 in the previous table
  
A resource X does not exist in the infrastructure.  However, it does exist in the Terraform state - it was previously created using Terraform but was later manually deleted from the infrastructure.  It does exist in the Terraform configuration - so we do want to re-create it.  

Terraform will first refresh its state-file, so it uses the provider's `Read`-method to try to get the latest information about this resource from the infrastructure.  Since the resource doesn't exist in the infrastructure, Terraform will clear the resource from its state-file.  

Terraform will then apply the terraform configuration, and will use the provider's `Create`-method to create the resource.  The `Create`-method is typically implemented to return the output of the provider's `Read`-method, and the `Read`-method updates the new Terraform state-file.  This will get infrastructure, Terraform state and Terraform configuration in-line with each other.

<br/>

For instance, take line 4 in the previous table
  
A resource Y does exist in the infrastructure.  However, it does not exist in the Terraform state - it was manually created in the infrastructure.  It does exist in the Terraform configuration - so we do want to create it.  

Terraform will not refresh its state-file because the resource is not known to Terraform.

Terraform then try to apply the terraform configuration, and will use the provider's `Create`-method to create the resource.  The `Create`-method is typically implemented to throw an error when a resource already exists, so Terraform will not create anything in the infrastructure and will not update its state-file.

<br/>

For instance, take line 8 in the previous table

A resource Z does exist in the infrastructure.  It does exist in the Terraform state - it was previously created using Terraform but some of its attributes may have been changed since.  It does exist in the Terraform configuration - so we do want to get update its attributes in-line with the Terraform configuration.  

Terraform will first refresh its state-file, so it uses the provider's `Read`-method to get the latest information about this resource from the infrastructure, and will update the resource's attributes in its state-file.  

Terraform will then apply the terraform configuration, and finds there are some attributes that are different from the Terraform configuration.  Since the provider doesn't implement an `Update`-method, Terraform will `Delete`, `Create` and `Read` the resource to get infrastructure, Terraform state and Terraform configuration in-line with each other.

> :information_source:  
> Because there is no `Update`-method, one **must** set  `ForceNew: true` for all attributes in the schema, except for the `Computed` attributes.  This forces Terraform to use `Delete` + `Create` instead of `Update`.

<br/>

### Adding The `Update` Method

Forcing all resources to be deleted and re-created every time one of its attributes needs to be changed is not the most efficient way of working.  Hence let's add the `Update`-method to the Terraform Provider.  This means we don't need to add `ForceNew: true` to all non-`Computed` attributes anymore, we can now do this selectively, only for attributes that cannot be changed without re-creating the resource.

<br/>

resource                                                                     | &nbsp; | terraform refresh           | terraform apply
:----------------------------------------------------------------------------|--------|:----------------------------|:---------------------
 &nbsp;                           - not in infrastructure                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                         | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      1 | ---                         | Create, Read
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      2 | Read (clear state)          |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      3 | Read (clear state)          | Create, Read
 &nbsp;                           - in infrastructure                        | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                         | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      4 | ---                         | Create (error)
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      5 | Read (refresh state)        | Delete
 &nbsp; &emsp; &emsp;                  --- in terraform config               | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp;               > config same as state            |      6 | Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed computed attributes  |      7 | Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp;               > config different from state     | &nbsp; |                      &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed force-new attributes |      8 | Read (refresh state)        | Delete, Create, Read
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed common attributes    |      9 | **Read (refresh state)**    | **Update, Read**

<br/>

Let's have a look at what changed - take line 9 in the previous table

A resource Z* does exist in the infrastructure.  It does exist in the Terraform state - it was previously created using Terraform but some of its attributes may have been changed since.  It does exist in the Terraform configuration - so we do want to get update its attributes in-line with the Terraform configuration.  

Terraform will first refresh its state-file, so it uses the provider's `Read`-method to get the latest information about this resource from the infrastructure, and will update the resource's attributes in its state-file.  

Terraform will then apply the terraform configuration, and finds there are some attributes that are different from the Terraform configuration.  Terraform will use the provider's `Update`-method to update the resource.  The `Update`-method is typically implemented to return the output of the provider's `Read`-method, and the `Read`-method updates the new Terraform state-file.  This will get infrastructure, Terraform state and Terraform configuration in-line with each other.

<br/>

### Adding The `Exists` Method

The `Read`-method can be a very expensive method.  A Terraform Provider may implement an `Exists`-method to avoid this in some use-cases.

<br/>

resource                                                                     | &nbsp; | terraform refresh                       | terraform apply
:----------------------------------------------------------------------------|--------|:----------------------------------------|:---------------------
 &nbsp;                           - not in infrastructure                    | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                                     | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      1 | ---                                     | Create, Read
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      2 | **Exists** (clear state)                |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      3 | **Exists** (clear state)                | Create, Read
 &nbsp;                           - in infrastructure                        | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp;                      -- not in terraform state                | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      - | ---                                     | ---
 &nbsp; &emsp; &emsp;                  --- in terraform config               |      4 | ---                                     | Create (error)
 &nbsp; &emsp;                      -- in terraform state                    | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp;                  --- not in terraform config           |      5 | **Exists**, Read (refresh state)        | Delete
 &nbsp; &emsp; &emsp;                  --- in terraform config               | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp;               > config same as state            |      6 | **Exists**, Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed computed attributes  |      7 | **Exists**, Read (refresh state)        | ---
 &nbsp; &emsp; &emsp; &emsp;               > config different from state     | &nbsp; |                                  &nbsp; |                      &nbsp;
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed force-new attributes |      8 | **Exists**, Read (refresh state)        | Delete, Create, Read
 &nbsp; &emsp; &emsp; &emsp; &emsp;          >> changed common attributes    |      9 | **Exists**, Read (refresh state)        | Update, Read

<br/>

For instance, take line 3 in the previous table
  
A resource X* does not exist in the infrastructure.  However, it does exist in the Terraform state - it was previously created using Terraform but was later manually deleted from the infrastructure.  It does exist in the Terraform configuration - so we do want to re-create it.  

Terraform will first refresh its state-file, so it uses the provider's `Exists`-method to find out if this resource exists in the infrastructure.  Since the resource doesn't exist in the infrastructure, Terraform will clear the resource from its state-file.  

Terraform will then apply the terraform configuration, and will use the provider's `Create`-method to create the resource.  The `Create`-method is typically implemented to return the output of the provider's `Read`-method, and the `Read`-method updates the new Terraform state-file.  This will get infrastructure, Terraform state and Terraform configuration in-line with each other.  

