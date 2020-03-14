---
layout: post
tags: [ terraform-provider ]

title: "Implementing A Terraform Provider"
description: "I recently started working on Terraform Provider plugins.  In this post I'm showing how to implement a simple Terraform provider."

date: 2020-02-17 14:18:37 +0000
toc: true
comments: true
---

I recently started working on Terraform Provider plugins, but there doesn't seem to be much information about plugin-development out there on the internet.  So I decided to collect some of my experience in a couple of posts.

![refresh-plan-apply.png](/assets/images/refresh-plan-apply-small.png)

For more information about the Terraform resource lifecycle:

- [The Terraform Resource Lifecycle]({% post_url 2020-02-15-the-terraform-resource-lifecycle %})

For more information about Terraform Provider plugins:
- [Extending Terraform](https://www.terraform.io/docs/extend/index.html)
- [GoDoc: Terraform Plugin SDK](https://godoc.org/github.com/hashicorp/terraform-plugin-sdk/helper)
- [GitHub: /hashicorp/terraform-plugin-sdk](https://github.com/hashicorp/terraform-plugin-sdk)

<br/>

Let's implement a Terraform provider `abc` with a data-source `abc_xyz` and a resource `abc_xyz`.  Most Terraform provider follow the same pattern.
 
We are using the following directory/file structure.

- `github.com/stefaanc/terraform-provider-abc`
  - `abc`
    - `config.go` 
    - `datasource_abc_xyz.go`
    - `provider.go`
    - `resource_abc_xyz.go`
  - `api`
    - `client.go`
    - `xyz.go`
  - `main.go` 

The `main.go` file will look something like

```go
// github.com/stefaanc/terraform-provider-abc/main.go

package main

import (
    "github.com/hashicorp/terraform-plugin-sdk/plugin"
    "github.com/stefaanc/terraform-provider-abc/abc"
)

func main() {
    plugin.Serve(&plugin.ServeOpts{
        ProviderFunc: abc.Provider,
    })
}
```

<br/>

### The Provider

We need a provider.  To keep things simple, our provider's configuration will have one attribute: `name`.  We are not going to use this attribute in this post, but imagine this is the name of the host where the resources are residing, under control of this provider.

```go
// github.com/stefaanc/terraform-provider-abc/abc/provider.go

package abc

import (
    "github.com/hashicorp/terraform-plugin-sdk/terraform"
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
)

func Provider() terraform.ResourceProvider {
    return &schema.Provider{
        Schema: map[string]*schema.Schema {
            // config attributes
            "name": &schema.Schema{
                Type:     schema.TypeString,
                Optional: true,
                Default: "my-host",
            },
        },

        DataSourcesMap: map[string]*schema.Resource {
            "abc_xyz": dataSourceABCXYZ(),
        },

        ResourcesMap: map[string]*schema.Resource{
            "abc_xyz": resourceABCXYZ(),
        },

        ConfigureFunc: providerConfigure,
    }
}

func providerConfigure(d *schema.ResourceData) (interface{}, error) {
    config := Config{
        Name: d.Get("name").(string),
    }

    return config.Client()
}
```

We need a provider config.

```go
// github.com/stefaanc/terraform-provider-abc/abc/config.go

package abc

import (
    "github.com/stefaanc/terraform-provider-abc/api"
)

type Config struct {
    // config attributes
    Name string
}

func (c *Config) Client() (interface {}, error) {
    // process the attributes of the provider's configuration `c`, and initialize the provider API
    client := new(api.ABCClient)
    client.Name = c.Name

    return client, nil
}
```

And we need a provider API.

```go
// github.com/stefaanc/terraform-provider-abc/api/client.go

package api

import (
)

type ABCClient struct {
    Name string
}
```

<br/>

### Data-Sources

We need a schema for our data-source `abc_xyz`.  Our data-source will have two attributes: `name` to identify the resource, and `status` read from the infrastructure.  We will not really read anything from infrastructure, but will just return some values to emulate a real data-source in the infrastructure.

```go
// github.com/stefaanc/terraform-provider-abc/abc/datasource_abc_xyz

package abc

import (
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
)

func dataSourceABCXYZ() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "name": &schema.Schema{
                Type:     schema.TypeString,
                Required: true,
            },
            "status": &schema.Schema{
                Type:     schema.TypeString,
                Computed: true,
            },
        },

        Read: dataSourceABCXYZRead,
    }
}
```

We need a data-source API

```
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

package api

import (
)

type XYZ struct {
    Name   string
    Status string
}
```

<br/>

Terraform needs a `Read`-method.

```go
// github.com/stefaanc/terraform-provider-abc/abc/datasource_abc_xyz

func dataSourceABCXYZRead(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the data-source
    name := d.Get("name").(string)

    // read the data-source's information from the infrastructure
    xyz, err := c.ReadXYZ(name)
    if err != nil {
        return err
    }

    // set Terraform state
    d.Set("name",   xyz.Name)
    d.Set("status", xyz.Status)

    // set id
    d.SetId(name)

    return nil
}
```

And the data-source API needs a `Read`-method

```go
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

func (c *ABCClient) ReadXYZ(name string) (xyz *XYZ, err error) {
    // read the data-source's information from the infrastructure
    // for this post, we are just returning some values
    xyz = new(XYZ)
    xyz.Name   = name
    xyz.Status = "open"
    
    return xyz, nil
}
```

<br/>

### Resources

We need a schema for our resource `abc_xyz`.  Our resource will have two attributes: `name` to identify the resource, and `status` to create, read, update in/from the infrastructure.  We will not really create anything in the infrastructure, and will just return some values when reading, to emulate a real resource in the infrastructure.

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

package abc

import (
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
)

func ResourceABCXYZ() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "name": &schema.Schema{
                Type:     schema.TypeString,
                Required: true,
                ForceNew: true,
            },
            "status": &schema.Schema{
                Type:     schema.TypeString,
                Optional: true,
                Default:  "closed",
            },
        },

        Create: resourceABCXYZCreate,
        Read:   resourceABCXYZRead,
        Update: resourceABCXYZUpdate,
        Delete: resourceABCXYZDelete,
    }
}
```

> :information_source:  
> Compared to the data-source:  
> - the attribute `status` is now `Optional` instead of `Computed`  
> - we now have the methods `Create`, `Read`, `Update` and `Delete` instead of `Read` only  

We reuse the same API as for the data-source

```
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

package api

import (
)

type XYZ struct {
    Name   string
    Status string
}
```

<br/>

Terraform needs a `Create`-method.

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZCreate(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the configured attributes of the resource
    name   := d.Get("name").(string)
    status := d.Get("status").(string)

    // create the resource in the infrastructure
    err := c.CreateXYZ(name, status)
    if err != nil {
        return err
    }

    // set id
    d.SetId(name)

    return resourceABCXYZRead(d, m)
}
```

> :information_source:  
> Note that the `Create`-method calls the `Read`-method when returning.

The resource API needs a `Create`-method

```go
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

func (c *ABCClient) CreateXYZ(name string, status string) error {
    // create the resource in the infrastructure
    // for this post, we do nothing
    
    return nil
}
```

<br/>

Terraform needs a `Read`-method.

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZRead(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // read the data-source's information from the infrastructure
    xyz, err := c.ReadXYZ(name)
    if err != nil {
        d.SetId("")
        return nil
    }

    // set Terraform state
    d.Set("name",   xyz.Name)
    d.Set("status", xyz.Status)

    return nil
}
```

> :information_source:  
> Compared to the data-source:  
> 
> - When the API `Read`-method returns an error, we set the ID to `""` and return `nil` instead of returning the error.  This allows this resource to be deleted from the Terraform state when Terraform refreshes its state.  
> - The function doesn't set the resource's ID, since this was already set when the resource was created.

We reuse the same API `Read`-method as for the data-source

```go
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

func (c *ABCClient) ReadXYZ(name string) (xyz *XYZ, err error) {
    // read the data-source's information from the infrastructure
    // for this post, we are just returning some values
    xyz = new(XYZ)
    xyz.Name   = name
    xyz.Status = "open"
    
    return xyz, nil
}
```

<br/>

Terraform needs an `Update`-method.

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZUpdate(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the configured attributes of the resource
    name   := d.Get("name").(string)
    status := d.Get("status").(string)

    // update the resource in the infrastructure
    err := c.UpdateXYZ(name, status)
    if err != nil {
        return err
    }

    return resourceABCXYZRead(d, m)
}
```

> :information_source:  
> Note that the `Update`-method calls the `Read`-method when returning.

The resource API needs an `Update`-method

```go
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

func (c *ABCClient) UpdateXYZ(name string, status string) error {
    // update the resource in the infrastructure
    // for this post, we do nothing
    
    return nil
}
```

<br/>

Terraform needs a `Delete`-method.

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZDelete(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // delete the resource from the infrastructure
    err := c.DeleteXYZ(name)
    if err != nil {
        return err
    }

    // set id
    d.SetId("")

    return nil
}
```

And the resource API needs a `Delete`-method

```go
// github.com/stefaanc/terraform-provider-abc/api/xyz.go

func (c *ABCClient) DeleteXYZ(name string) error {
    // delete the resource from the infrastructure
    // for this post, we do nothing
    
    return nil
}
```

<br/>

### Building & Running

I prepared a small package for this example provider, in case you want to play with it.

To build the provider:

1. Create a repository, for instance called `terraform-provider-abc`

2. Download the content from the `terraform-provider-abc` in [the `abc` package](/assets/2020-02-17-implementing-a-terraform-provider/terraform-provider-abc.zip) into your repository

   > :bulb:  
   > To make this a fully working Terraform provider, we extended the infrastructure-API presented in this post, creating a JSON-file with the `name` and `status` attributes, so the resource can be read, updated and deleted.  The `name` attribute is name of  the file.

3. Assuming you have `go` installed and properly configured,  
   in the `terraform-provider-abc` directory, 

    1. run `go mod tidy`  
    2. run `go build -o "$env:APPDATA/terraform.d/plugins"` (on Windows using Powershell)  
       or `go build -o "%APPDATA%\terraform.d\plugins"` (on Windows using CMD)  
       or `go build -o ~/.terraform.d/plugins` (on Linux)  

To run the provider:

1. Assuming you have `terraform` installed and properly configured,  
   in the `terraform-provider-abc/examples` directory, 

    1. run `terraform init`
    2. run `terraform plan`
    2. run `terraform apply`
    2. run `terraform destroy`

<br/>

---

### Related Posts

- [The Terraform Resource Lifecycle]({% post_url 2020-02-15-the-terraform-resource-lifecycle %})
- [Extending The Terraform Resource Lifecycle]({% post_url 2020-02-19-extending-the-terraform-resource-lifecycle %})

<br/>

---

EDIT 18-02-2020: code-corrections + added [Building & Running](#building--running) section  
EDIT 19-02-2020: extended the infrastructure-API in [the `abc` package](/assets/2020-02-17-implementing-a-terraform-provider/terraform-provider-abc.zip)  
