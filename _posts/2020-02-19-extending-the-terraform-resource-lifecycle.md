---
layout: post
title: "Extending The Terraform Resource Lifecycle"
tags: [ terraform-provider ]
date: 2020-02-19 12:41:55 +0000
comments: true
---

I recently started working on Terraform Provider plugins, but there doesn't seem to be much information about plugin-development out there on the internet.  So I decided to collect some of my experience in a couple of posts.

![refresh-plan-apply.png](/assets/images/refresh-plan-apply-small.png)

<br/>

I discussed the general Terraform behaviour in my post ["The Terraform Resource Lifecycle"]({% post_url 2020-02-15-the-terraform-resource-lifecycle %}), and the implementation of the required methods in my post ["Implementing A Terraform Provider"]({% post_url 2020-02-17-implementing-a-terraform-provider %}). 

Terraform allows the users to customize the resource lifecycle using the [`lifecycle` meta-argument](https://www.terraform.io/docs/configuration/resources.html#lifecycle-lifecycle-customizations) in their Terraform configuration.  The `lifecycle`-block supports the `create_before_destroy`, `prevent_destroy` and `ignore_changes` attributes for resources.  At this moment, no attributes are supported (yet) for data-sources.  In this post, I'll discuss a couple of extensions to these lifecycle customizations.

Terraform was developed to manage virtualized cloud resources.  However when I want to use Terraform for resources on a physical machine - for instance working with Hyper-V on my laptop or VMware ESXi on a server - then I need to be able to read and modify existing resources, and resources that cannot be created or deleted - for instance hardware resources like a NIC.  The current Terraform model isn't really coping well with this.  Terraform allows you to import resources, but that is to be done outside the Terraform configuration, manually or using a script.  That is why I add an `x_lifecycle`-block to some of my data-sources and resources.

<br/>

### Data-Sources

Sometimes we don't know if a data-source exists or not.  An example is the `Default Switch` in Hyper-V.  This was introduced in some version of Hyper-V.  We cannot read the data-source in Terraform, unless we are absolutely sure it exists, because Terraform will throw an error when it is not there.  We can certainly find out in what Hyper-V version this was added, test in the Terraform configuration for the version used in the infrastructure, and dynamically decide to read the resource or not.  However, this is a lot of effort and complexity, and that's all left for the user to find out and adapt his configuration.

Using the extended lifecycle attributes, we can read such data sources, without throwing an error when they don't exist.  This allows to implement dynamic Terraform behaviour depending on the existence of the data source.

#### Example Usage

```terraform
data "data_source" "my_data_source" {
    x_lifecycle {
        ignore_error_if_not_exists = true 
    }
}

output "my_data_source_exists" {
    value = data_source.my_data_source.x_lifecycle[0].exists
}
```

#### Argument Attributes Reference

- `ignore_error_if_not_exists` - (boolean, Optional, defaults to `false`) -  If the data-source doesn't exist, the Terraform state contains zeroed attributes for this data source.  No error is thrown. 

#### Exported Attributes Reference

- `exists` - (boolean) -  If `true`, the data-source exists, and the Terraform state contains the attributes of the data-source.

#### Implementation

The data-source's schema is typically implemented using the following pattern

```go
// github.com/stefaanc/terraform-provider-abc/abc/datasource_abc_xyz

package abc

import {
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

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

        Read: datasourceABCXYZRead,
    }
}
```

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/datasource_abc_xyz

package abc

import {
    "strings"

    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

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

            "x_lifecycle": &schema.Schema{
                Type:     schema.TypeList,
                MaxItems: 1,
                Optional: true,
                Computed: true,
                Elem: &schema.Resource{
                    Schema: map[string]*schema.Schema{
                        "ignore_error_if_not_exists": &schema.Schema{
                            Type:     schema.TypeBool,
                            Optional: true,
                            Default:  false,
                        },
                        "exists": &schema.Schema{
                            Type:     schema.TypeBool,
                            Computed: true,
                        },
                    },
                },
            },
        },

        Read: datasourceABCXYZRead,
    }
}
```

> :information_source:  
> - We added the `"strings"` import.  This will be used by the data-source's `Read`-method
> - We added the embedded `x_lifecycle`-resource.

<br/>

The data-source's `Read`-method is typically implemented using the following pattern

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/datasource_abc_xyz

func dataSourceABCXYZRead(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the data-source
    name := d.Get("name").(string)

    // get the embedded `x_lifecycle` resource
    x_lifecycle := make(map[string]interface{})
    listOfInterfaces1, ok := d.GetOk("x_lifecycle")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            x_lifecycle = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // read the data-source's information from the infrastructure
    xyz, err := c.ReadXYZ(name)
    if err != nil {

        // lifecycle customizations: `ignore_error_if_not_exists`
        v, ok := x_lifecycle["ignore_error_if_not_exists"]
        if ok && v.(bool) && strings.Contains(err.Error(), "cannot find xyz") {
 
            // set zeroed Terraform state
            d.Set("name",   "")
            d.Set("status", "")

            // set computed lifecycle attributes
            x_lifecycle["exists"] = false
            d.Set("x_lifecycle", []interface{}{ x_lifecycle })

            // set id
            d.SetId(name)

            return nil
        }

        // no lifecycle customizations
        return err
    }

    // set Terraform state
    d.Set("name",   xyz.Name)
    d.Set("status", xyz.Status)

    // set computed lifecycle attributes
    x_lifecycle["exists"] = true
    d.Set("x_lifecycle", []interface{}{ x_lifecycle })

    // set id
    d.SetId(name)

    return nil
}
```

> :information_source:  
> - We get the embedded `x_lifecycle`-resource and expand it.  
> - If the `ignore_error_if_not_exists` attribute is set and we get an error from the API `Read`-method indicating that the data-source cannot be found, Then
>   - we add a zeroed data-source object to the Terraform state
>   - we set the `Computed` attribute `exists` to `false` and return
> - Else
>   - we add the existing data-source object to the Terraform state
>   - we set the `Computed` attribute `exists` to `true` and return

<br/>

### Resources

Terraform supports importing resources using `terraform import`.  However, this requires a manual or scripted action outside the Terraform configuration.  Using the extended lifecycle attributes, this can be automated in Terraform.

#### Example Usage

```terraform
resource "resource" "my_resource" {
    x_lifecycle {
        import_if_exists    = true 
        destroy_if_imported = true
    }
}

output "my_resource_imported" {
    value = resource.my_resource.x_lifecycle[0].imported
}
```

#### Argument Attributes Reference

- `import_if_exists` - (boolean, Optional, defaults to `false`) -  If the resource exists, it is imported into the Terraform state, it's original attributes are saved so they can be reinstated at a later time, and the resource is updated based on the attributes in the Terraform configuration.  No error is thrown.

- `destroy_if_imported` - (boolean, Optional, defaults to `false`) - If the resource is imported and if this attribute is set to `false`, the resource's original attributes are restored when calling `terraform destroy`.  If the resource is imported and if this attribute is set to `true` the resource is destroyed when calling `terraform destroy`.

#### Exported Attributes Reference

- `imported` - (boolean) -  If `true`, the resource is imported.  Remark that this attribute is not set when the resource was imported using `terraform import`.

#### Implementation

The resource's schema is typically implemented using the following pattern

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

package abc

import {
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

package abc

import {
    "strings"

    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

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

            "x_lifecycle": &schema.Schema{
                Type:     schema.TypeList,
                MaxItems: 1,
                Optional: true,
                Computed: true,
                Elem: &schema.Resource{
                    Schema: map[string]*schema.Schema{
                        "import_if_exists": &schema.Schema{
                            Type:     schema.TypeBool,
                            Optional: true,
                            Default:  false,
                        },
                        "imported": &schema.Schema{
                            Type:     schema.TypeBool,
                            Computed: true,
                        },
                        "destroy_if_imported": &schema.Schema{
                            Type:     schema.TypeBool,
                            Optional: true,
                            Default:  false,
                        },
                    },
                },
            },
            
            "original": &schema.Schema{
                Type:     schema.TypeList,
                Computed: true,
                Elem: resourceABCXYZOriginal(),
            },
        },

        Create: resourceABCXYZCreate,
        Read:   resourceABCXYZRead,
        Update: resourceABCXYZUpdate,
        Delete: resourceABCXYZDelete,
    }
}

func resourceABCXYZOriginal() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "status": &schema.Schema{
                Type:     schema.TypeString,
                Computed: true,
            },
        },
    }
}
```
> :information_source:  
> - We added the `"strings"` import.  This will be used by the data-source's `Create`-method
> - We added the embedded `x_lifecycle`-resource.
> - We added the embedded `original`-resource to save the imported state so it can be restored when the resource is deleted from the Terraform state.

<br/>

The resource's `Create`-method is typically implemented using the following pattern

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZCreate(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the configured attributes of the resource
    name   := d.Get("name").(string)
    status := d.Get("status").(string)

    // get the embedded `x_lifecycle` resource
    x_lifecycle := make(map[string]interface{})
    listOfInterfaces1, ok := d.GetOk("x_lifecycle")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            x_lifecycle = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // set the embedded `original` resource
    // set it to an empty list instead of leaving it nil, so it doesn't trigger an update in subsequent terraform plan
    d.Set("original", []interface{}{ })

    // create the resource in the infrastructure
    err := c.CreateXYZ(name, status)
    if err != nil {

        // lifecycle customizations: `ignore_error_if_not_exists`
        v, ok := x_lifecycle["import_if_exists"]
        if ok && v.(bool) && strings.Contains(err.Error(), "xyz already exists") {

            // read the resource's information from the infrastructure
            xyz, err := c.ReadXYZ(name)
            if err != nil {
                return err
            }

            // set computed original infrastructure attributes, so they can be restored on destroy
            original := make(map[string]interface{})
            original["status"] = xyz.Status
            d.Set("original", []interface{}{ original })

            // set computed lifecycle attributes
            x_lifecycle["imported"] = true
            d.Set("x_lifecycle", []interface{}{ x_lifecycle })

            // check diff between the resource's Terraform configuration and infrastructure
            if !resourceABCXYZDiff(d, xyz) {
                // no update required - complete read

                // set Terraform state
                d.Set("name",   xyz.Name)
                d.Set("status", xyz.Status)

                // set id
                d.SetId(name)

                return nil

            } else {
                // update

                // update the resource in the infrastructure
                err := c.UpdateXYZ(name, status)
                if err != nil {
                    return err
                }

                // set id
                d.SetId(name)

                return resourceABCXYZRead(d, m)
            }
        }

        // no lifecycle customizations
        return err
    }

    // set computed lifecycle attributes
    x_lifecycle["imported"] = false
    d.Set("x_lifecycle", []interface{}{ x_lifecycle })

    // set id
    d.SetId(name)

    return resourceABCXYZRead(d, m)
}

func resourceABCXYZDiff(d *schema.ResourceData, xyz *api.XYZ) bool {
    if v, ok := d.GetOk("status"); ok && ( xyz.Status != v.(string) ) {
        return true
    }

    return false
}
```

> :information_source:   
> - We get the embedded `x_lifecycle`-resource and expand it  
> - If the `import_if_exists` attribute is set and we get an error from the API `Create`-method indicating that the data-source already exists, Then  
>   - we read the resource from the infrastructure  
>   - we store the read information in the embedded `original` object in the Terraform state  
>   - we set the `Computed` attribute `imported` to `true` 
>   - If the read information is the same a the resource's Terraform configuration, Then 
>     - we complete the read operation in the same way as the resource's `Read`-method, and return
>   - Else
>     - we update the resource in the same way as the resource's `Update`-method, and return
> - Else
>   - we set the `Computed` attribute `imported` to `false` and return

<br/>

The resource's `Delete`-method is typically implemented using the following pattern

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZDelete(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // get the embedded `x_lifecycle` resource
    x_lifecycle := make(map[string]interface{})
    listOfInterfaces1, ok := d.GetOk("x_lifecycle")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            x_lifecycle = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // lifecycle customizations: destroy_if_imported
    if ( x_lifecycle != nil ) || ( x_lifecycle["imported"].(bool) && !x_lifecycle["destroy_if_imported"].(bool) ) {
        // get the embedded `original` resource
        original := map[string]interface{}( nil )
        listOfInterfaces1, ok = d.GetOk("original")
        if ok {
            listOfInterfaces2 := listOfInterfaces1.([]interface{})
            if len(listOfInterfaces2) > 0 {
                original = listOfInterfaces2[0].(map[string]interface{})
            }
        }

        // update the resource in the infrastructure
        if original != nil {
            err := c.UpdateXYZ(name, original["status"].(string))
            if err != nil {
                return err
            }
        }

    } else {

        // delete the resource from the infrastructure
        err := c.DeleteXYZ(name)
        if err != nil {
            return err
        }
    }

    // set id
    d.SetId("")

    return nil
}
```

> :information_source:   
> - We get the embedded `x_lifecycle`-resource and expand it  
> - If the `imported` attribute is set and the `destroy_if_imported` attribute is not set, Then  
>   - we update the resource with its originally imported attribute-values in the infrastructure  
> - Else
>   - we delete the resource from the infrastructure

<br/>

### Persistent Resources

A special class of resources are resources that cannot be created using Terraform, and cannot be destroyed using Terraform.  In this respect they behave similar to data-sources.  However, unlike data-sources but like non-persistent resources, we can change some of the properties of these resources.  Typical examples are physical resources or resources that are related to physical resources, like a physical machine or a physical network adapter.

For these resources:
 
- Terraform's `Create`-method imports the resource, saves the originally imported state so it can be reinstated at a later time, and updates the resource based on the attributes in the Terraform configuration.  
- Terraform's `Delete`-method reinstates the originally imported state. 

This behaviour **implicitly** corresponds to the `x-lifecycle` behaviour for resources, where `import_if_exists = true` and `destroy_if_imported = false`.

These persistent resources can also **explicitly** support the `x-lifecycle` behaviour for data-sources.

#### Example Usage

```terraform
resource "persistent_resource" "my_persistent_resource" {
    x_lifecycle {
        ignore_error_if_not_exists = true 
    }
}

output "my_persistent_resource_exists" {
    value = persistent_resource.my_persistent_resource.x_lifecycle[0].exists
}
```

#### Argument Attributes Reference

- `ignore_error_if_not_exists` - (boolean, Optional, defaults to `false`) -  If the resource doesn't exist, the Terraform state contains zeroed attributes for this resource.  No error is thrown. 

#### Exported Attributes Reference

- `exists` - (boolean) -  If `true`, the resource exists, and the Terraform state contains the attributes of the resource.

#### Implementation

The changes for a persistent resource are a mix of the changes for a data-source and the changes for a non-persistent resource.

The resource's schema is typically implemented using the following pattern

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

package abc

import {
    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

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

To extend the lifecycle, we change this as follows 

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

package abc

import {
    "strings"

    "github.com/hashicorp/terraform-plugin-sdk/helper/schema"
    "github.com/stefaanc/terraform-provider-abc/api"
}

func resourceABCXYZ() *schema.Resource {
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

            "x_lifecycle": &schema.Schema{
                Type:     schema.TypeList,
                MaxItems: 1,
                Optional: true,
                Computed: true,
                Elem: &schema.Resource{
                    Schema: map[string]*schema.Schema{
                        "ignore_error_if_not_exists": &schema.Schema{
                            Type:     schema.TypeBool,
                            Optional: true,
                            Default:  false,
                        },
                        "exists": &schema.Schema{
                            Type:     schema.TypeBool,
                            Computed: true,
                        },
                    },
                },
            },
            
            "original": &schema.Schema{
                Type:     schema.TypeList,
                Computed: true,
                Elem: resourceABCXYZOriginal(),
            },
        },

        Create: resourceABCXYZCreate,
        Read:   resourceABCXYZRead,
        Update: resourceABCXYZUpdate,
        Delete: resourceABCXYZDelete,
    }
}

func resourceABCXYZOriginal() *schema.Resource {
    return &schema.Resource{
        Schema: map[string]*schema.Schema{
            "status": &schema.Schema{
                Type:     schema.TypeString,
                Computed: true,
            },
        },
    }
}
```

> :information_source:  
> - We added the `"strings"` import.  This will be used by the data-source's `Create`- and `Read`-methods
> - Identical to the data-source
>   - We added the embedded `x_lifecycle`-resource.
> - Identical to a non-persistent resource
>   - We added the embedded `original`-resource.
> - Remark that when the resource doesn't exist, it will try to find it on every terraform apply

<br/>

The resource's `Create`-method is typically implemented using the following pattern

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZCreate(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the configured attributes of the resource
    name   := d.Get("name").(string)
    status := d.Get("status").(string)

    // get the embedded `x_lifecycle` resource
    x_lifecycle := make(map[string]interface{})
    listOfInterfaces1, ok := d.GetOk("x_lifecycle")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            x_lifecycle = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // read the resource's information from the infrastructure
    xyz, err := c.ReadXYZ(name)
    if err != nil {

        // lifecycle customizations: `ignore_error_if_not_exists`
        v, ok := x_lifecycle["ignore_error_if_not_exists"]
        if ok && v.(bool) && strings.Contains(err.Error(), "cannot find xyz") {
 
            // set zeroed Terraform state
            d.Set("name",   "")
            d.Set("status", "")
            d.Set("original", []interface{}{ })

            // set computed lifecycle attributes
            x_lifecycle["exists"] = false
            d.Set("x_lifecycle", []interface{}{ x_lifecycle })

            // set id
            d.SetId(name)

            return nil
        }

        // no lifecycle customizations
        return err
    }

    // set computed original infrastructure attributes, so they can be restored on destroy
    original := make(map[string]interface{})
    original["status"] = xyz.Status
    d.Set("original", []interface{}{ original })

    // set computed lifecycle attributes
    x_lifecycle["exists"] = true
    d.Set("x_lifecycle", []interface{}{ x_lifecycle })

    // check diff between the resource's Terraform configuration and infrastructure
    if !resourceABCXYZDiff(d, xyz) {
        // no update required - complete read

        // set Terraform state
        d.Set("name",   xyz.Name)
        d.Set("status", xyz.Status)

        // set id
        d.SetId(name)

        return nil

    } else {
        // update

        // update the resource in the infrastructure
        err := c.UpdateXYZ(name, status)
        if err != nil {
            return err
        }

        // set id
        d.SetId(name)

        return resourceABCXYZRead(d, m)
    }
}

func resourceABCXYZDiff(d *schema.ResourceData, xyz *api.XYZ) bool {
    if v, ok := d.GetOk("status"); ok && ( xyz.Status != v.(string) ) {
        return true
    }

    return false
}
```

> :information_source: 
> - A persistent resource cannot be created, so the API's `Create`-method is not available  
> - We get the embedded `x_lifecycle`-resource and expand it  
> - Identical to a non-persistent resource
>   - we read the resource from the infrastructure  
>   - we store the read information in the embedded `original` object in the Terraform state  
>   - If the read information is the same a the resource's Terraform configuration, Then 
>     - we complete the read operation in the same way as the resource's `Read`-method, and return
>   - Else
>     - we update the resource in the same way as the resource's `Update`-method, and return
> - Identical to the data-source
>   - If the `ignore_error_if_not_exists` attribute is set and we get an error from the API `Read`-method indicating that the data-source cannot be found, Then
>     - we add a zeroed data-source object to the Terraform state
>     - we set the `Computed` attribute `exists` to `false` and return
>   - Else
>     - we add the existing data-source object to the Terraform state
>     - we set the `Computed` attribute `exists` to `true` and return

<br/>

The resource's `Read`-method is typically implemented using the following pattern

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZRead(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // read the resource's information from the infrastructure
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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func reourceABCXYZRead(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // get the embedded `x_lifecycle` resource
    x_lifecycle := make(map[string]interface{})
    listOfInterfaces1, ok := d.GetOk("x_lifecycle")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            x_lifecycle = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // read the resource's information from the infrastructure
    xyz, err := c.ReadXYZ(name)
    if err != nil {

        // lifecycle customizations: `ignore_error_if_not_exists`
        v, ok := x_lifecycle["ignore_error_if_not_exists"]
        if ok && v.(bool) && strings.Contains(err.Error(), "cannot find xyz") {
 
            // set zeroed Terraform state
            d.Set("name",   "")
            d.Set("status", "")
            d.Set("original", []interface{}{ })

            // set computed lifecycle attributes
            x_lifecycle["exists"] = false
            d.Set("x_lifecycle", []interface{}{ x_lifecycle })

            return nil
        }

        // no lifecycle customizations
        d.SetId("")
        return nil
    }

    // set Terraform state
    d.Set("name",   xyz.Name)
    d.Set("status", xyz.Status)

    // set computed lifecycle attributes
    x_lifecycle["exists"] = true
    d.Set("x_lifecycle", []interface{}{ x_lifecycle })

    return nil
}
```

> :information_source:  
> - We get the embedded `x_lifecycle`-resource and expand it.  
> - Identical to the data-source
>   - If the `ignore_error_if_not_exists` attribute is set and we get an error from the API `Read`-method indicating that the data-source cannot be found, Then
>     - we add a zeroed data-source object to the Terraform state
>     - we set the `Computed` attribute `exists` to `false` and return
>   - Else
>     - we add the existing data-source object to the Terraform state
>     - we set the `Computed` attribute `exists` to `true` and return

<br/>

The resource's `Delete`-method is typically implemented using the following pattern

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

To extend the lifecycle, we change this as follows

```go
// github.com/stefaanc/terraform-provider-abc/abc/resource_abc_xyz

func resourceABCXYZDelete(d *schema.ResourceData, m interface{}) error {
    c := m.(*api.ABCClient)

    // get the identifying attributes of the resource
    name := d.Get("name").(string)

    // get the embedded `original` resource
    original := map[string]interface{}( nil )
    listOfInterfaces1, ok := d.GetOk("original")
    if ok {
        listOfInterfaces2 := listOfInterfaces1.([]interface{})
        if len(listOfInterfaces2) > 0 {
            original = listOfInterfaces2[0].(map[string]interface{})
        }
    }

    // update the resource in the infrastructure
    if original != nil {
        err := c.UpdateXYZ(name, original["status"].(string))
        if err != nil {
            return err
        }
    }

    // set id
    d.SetId("")

    return nil
}
```

> :information_source:   
> - A persistent resource cannot be deleted, so the API's `Delete`-method is not available  
> - Identical to a non-persistent resource
>   - we update the resource with its originally imported attribute-values in the infrastructure  

<br/>

### Building & Running

I prepared a small package for this example provider, in case you want to play with it.

To build the provider:

1. Create a repository, for instance called `terraform-provider-abc`

2. Download the content from the `terraform-provider-abc` in [the extended `abc` package](/assets/2020-02-19-extending-the-terraform-resource-lifecycle/terraform-provider-abc-extended.zip) or [the persistent `abc` package](/assets/2020-02-19-extending-the-terraform-resource-lifecycle/terraform-provider-abc-persistent.zip) into your repository

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
- [Implementing A Terraform Provider]({% post_url 2020-02-17-implementing-a-terraform-provider %})

<br/>

---
