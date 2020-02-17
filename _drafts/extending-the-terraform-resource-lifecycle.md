---
layout: post
title: "Extending The Terraform Resource Lifecycle"
tags: [ terraform-provider ]
date: 2020-02-17 21:18:37 +0000
comments: true
---

I recently started working on Terraform Provider plugins, but there doesn't seem to be much information about plugin-development out there on the internet.  So I decided to collect some of my experience in a couple of posts.

![refresh-plan-apply.png](/assets/2020-02-15-the-terraform-resource-lifecycle/refresh-plan-apply.png)

I discussed the general Terraform behaviour in my post ["The Terraform Resource Lifecycle"](\_posts\2020-02-15-the-terraform-resource-lifecycle.md).  Terraform allows the users to customize the resource lifecycle using the [`lifecycle` meta-argument](https://www.terraform.io/docs/configuration/resources.html#lifecycle-lifecycle-customizations) in their Terraform configuration.  The `lifecycle`-block supports the `create_before_destroy`, `prevent_destroy` and `ignore_changes` attributes for resources.  At this moment, no attributes are supported (yet) for data-sources.  In this post, I'll discuss a couple of extensions to these lifecycle customizations.

Terraform was developed to manage virtualized cloud resources.  However when I want to use Terraform for resources on a physical machine - for instance working with Hyper-V on my laptop or VMware ESXi on a server - then I need to be able to read and modify existing resources, resources that cannot be created or deleted - for instance hardware resources like a NIC.  The current Terraform model isn't really coping well with this.  Terraform allows you to import resources, but that is to be done outside the Terraform configuration, manually or using a script.  That is why I add an `x_lifecycle`-block to some of my data-sources and resources.

<br/>

### Data-Sources

Sometimes we don't know if a data source exists or not.  An example is the `Default Switch` in Hyper-V.  This was introduced in some version of Hyper-V.  We cannot read the data source in Terraform, unless we are absolutely sure it exists, because Terraform will throw an error when it is not there.  We can certainly find out in what Hyper-V version this was added, test in the Terraform configuration for the version used in the infrastructure, and dynamically decide to read the resource or not.  However, this is a lot of effort and complexity.

Using the extended lifecycle attributes, we can read such data sources, without throwing an error when they don't exist.  This allows to implement dynamic Terraform behaviour depending on the existence of the data source.

###### Example Usage

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

###### Argument Attributes Reference

- `ignore_error_if_not_exists` - (boolean, Optional, defaults to `false`) -  If the data-source doesn't exist, the Terraform state contains zeroed attributes for this data source.  No error is thrown. 

###### Exported Attributes Reference

- `exists` - (boolean) -  If `true`, the data-source exists, and the Terraform state contains the attributes of the data-source.

###### Implementation

Data-sources are typically implemented using the following pattern

```go

```



<br/>

### Resources

Terraform support importing resources using `terraform import`.  However, this requires a manual or scripted action outside the Terraform configuration.  Using the extended lifecycle attributes, this can be automated in Terraform.

###### Example Usage

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

###### Argument Attributes Reference

- `import_if_exists` - (boolean, Optional, defaults to `false`) -  If the resource exists, it is imported into the Terraform state, it's original attributes are saved so they can be reinstated at a later time, and the resource is updated based on the attributes in the Terraform configuration.  No error is thrown.

- `destroy_if_imported` - (boolean, Optional, defaults to `false`) - If the resource is imported and if this attribute is set to `false`, the resource's original attributes are restored when calling `terraform destroy`.  If the resource is imported and if this attribute is set to `true` the resource is destroyed when calling `terraform destroy`.

###### Exported Attributes Reference

- `imported` - (boolean) -  If `true`, the resource is imported.  Remark that this attribute is not set when the resource was imported using `terraform import`.

###### Implementation

Resources are typically implemented using the following pattern

```go

```



<br/>

### Persistent Resources

A special class of resources are resources that cannot be created using Terraform, and cannot be destroyed using Terraform.  In this respect they behave similar to data-sources.  However, unlike data-sources but like non-persistent resources, we can change some of the properties of these resources.  Typical examples are physical resources or resources that are related to physical resources, like a physical machine or a physical network adapter.

For these resources:
 
- Terraform's `Create`-method imports the resource, saves the originally imported state so it can be reinstated at a later time, and updates the resource based on the attributes in the Terraform configuration.  
- Terraform's `Delete`-method reinstates the originally imported state. 

This behaviour **implicitly** corresponds to the `x-lifecycle` behaviour for resources, where `import_if_exists = true` and `destroy_if_imported = false`.

These persistent resources can also **explicitly** support the `x-lifecycle` behaviour for data-sources.

###### Example Usage

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

###### Argument Attributes Reference

- `ignore_error_if_not_exists` - (boolean, Optional, defaults to `false`) -  If the resource doesn't exist, the Terraform state contains zeroed attributes for this resource.  No error is thrown. 

###### Exported Attributes Reference

- `exists` - (boolean) -  If `true`, the resource exists, and the Terraform state contains the attributes of the resource.

###### Implementation



<br/>