---
layout: post
title: "Customizing The Terraform Plan"
tags: [ terraform-provider ]
date: 2020-02-24 11:29:16 +0000
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


https://www.terraform.io/docs/extend/resources/customizing-differences.html



<br/>

#### Customizing Attributes

attribute                                  | &nbsp; | Computed          | SetNew           | SetNewComputed
:------------------------------------------|--------|:------------------|:-----------------|:-------------------------------
             - not in terraform state      | &nbsp; |             &nbsp;|            &nbsp;|                          &nbsp;
 &nbsp;         -- not in terraform config | 1      | known after apply | **new**          | known after apply
 &nbsp;         -- in terraform config     | 2      | &lt;error&gt;     | &lt;error&gt;    | &lt;error&gt;
             - in terraform state          | &nbsp; |             &nbsp;|            &nbsp;|                          &nbsp;
 &nbsp;         -- not in terraform config | 3      | state *[1]*       |            &nbsp;| **state -><br/>known after apply**
 &nbsp;&emsp;      >> new == state         | 3a     |             &nbsp;| state            |                          &nbsp;
 &nbsp;&emsp;      >> new != state         | 3b     |             &nbsp;| **state -> new** |                          &nbsp;
 &nbsp;         -- in terraform config     | 4      | &lt;error&gt;     | &lt;error&gt;    | &lt;error&gt; 

attribute                                        | &nbsp; | Optional &<br/>Computed | SetNew           | SetNewComputed
:------------------------------------------------|--------|:------------------------|:-----------------|:-------------------------------
                    - not in terraform state     | &nbsp; |                   &nbsp;|            &nbsp;|                          &nbsp; 
 &nbsp;               -- not in terraform config | 1      | known after apply       |            &nbsp;| known after apply
 &nbsp;               -- in terraform config     | 2      | config                  | **new**          | **known after apply**            
 &nbsp;&emsp;            >> new == config        | 2a     |                   &nbsp;| config           |                          &nbsp;
 &nbsp;&emsp;            >> new != config        | 2b     |                   &nbsp;| **new**          |                          &nbsp;
                    - in terraform state         | &nbsp; |                   &nbsp;|            &nbsp;|                          &nbsp; 
 &nbsp;               -- not in terraform config | 3      | state *[1]*             |            &nbsp;| **state -><br/>known after apply**
 &nbsp;&emsp;            >> new == state         | 3a     |                   &nbsp;| state            |                          &nbsp;
 &nbsp;&emsp;            >> new != state         | 3b     |                   &nbsp;| **state -> new** |                          &nbsp;
 &nbsp;               -- in terraform config     | &nbsp; |                   &nbsp;|            &nbsp;|                          &nbsp;
 &nbsp;&emsp;            > config == state       | 4a     | state                   |            &nbsp;| state
 &nbsp;&emsp;&emsp;        >> new == state       | 4a1    |                   &nbsp;| state            |                          &nbsp;
 &nbsp;&emsp;&emsp;        >> new != state       | 4a2    |                   &nbsp;| **state -> new** |                          &nbsp;
 &nbsp;&emsp;            > config != state       | 4b     | state -> config         |            &nbsp;| state -> config      
 &nbsp;&emsp;&emsp;        >> new == config      | 4b1    |                   &nbsp;| state -> config  |                          &nbsp;
 &nbsp;&emsp;&emsp;        >> new != config      | 4b2    |                   &nbsp;| **state -> new** |                          &nbsp;


`--- (null)`: No operation planned.  Attribute doesn't appear in terraform plan.  
`--- (state)`: No operation planned.  Attribute appears with state value in terraform plan.  
`add (config)`: Plan is to add attribute to terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`add (default)`: Plan is to add attribute to terraform state with default value if default value is not `""`, otherwise fall back to the "Optional" column.
`add (unknown)`: Plan is to add attribute to terraform state with currently unknown computed value.
`update (state -> config)`: Plan is to update attribute in terraform state with config value if config value is not `""`, otherwise fall back to the "not in terraform config" row.
`update (state -> default)`: Plan is to update attribute in terraform state with default value if default value is not `""`, otherwise fall back to the " "Optional" column.
`update (state -> unknown)`: Plan is to update attribute in terraform state with currently unknown computed value.  (not default terraform behaviour - see `*1`)
`remove <br/> (state -> null)`: Plan is to remove attribute from terraform state.

`*1`: Use `CustomizeDiff` with `SetNewComputed` to change to plan for computed attributes from `--- (state)` to `update (state -> unknown)`, in order to avoid possible issues with downstream operations, and avoid resulting legacy plugin SDK warnings in terraform log.

<br/>

#### Customizing Embedded Resources

resource                            | &nbsp; | Computed          | SetNew               | SetNewComputed
:-----------------------------------|--------|:------------------|:---------------------|:-------------------------------
             - not in tf state      | &nbsp; |             &nbsp;|                &nbsp;|                          &nbsp;
 &nbsp;         -- not in tf config | 1      | known after apply | **{ new }**          | known after apply
 &nbsp;         -- in tf config     | 2      | &lt;error&gt;     | &lt;error&gt;        | &lt;error&gt;
             - in tf state          | &nbsp; |             &nbsp;|                &nbsp;|                          &nbsp;
 &nbsp;         -- not in tf config | 3      | { state } *[1]*   |                &nbsp;| **{ state } -><br/>known after apply**
 &nbsp;&emsp;      >> new == state  | 3a     |             &nbsp;| { state }            |                          &nbsp;
 &nbsp;&emsp;      >> new != state  | 3b     |             &nbsp;| **{ state -> new }** |                          &nbsp;
 &nbsp;         -- in tf config     | 4      | &lt;error&gt;     | &lt;error&gt;        | &lt;error&gt; 

resource                                    | &nbsp; | Optional &<br/>Computed     | SetNew               | SetNewComputed
:-------------------------------------------|--------|:----------------------------|:---------------------|:-------------------------------
                    - not in tf state       | &nbsp; |                       &nbsp;|                &nbsp;|                          &nbsp; 
 &nbsp;               -- not in tf config   | 1      | known after apply           |                &nbsp;| known after apply
 &nbsp;               -- in tf config       | 2      | { config }                  | **{ new }**          | **known after apply**            
 &nbsp;&emsp;            >> new == config   | 2a     |                       &nbsp;| { config }           |                          &nbsp;
 &nbsp;&emsp;            >> new != config   | 2b     |                       &nbsp;| **{ new }**          |                          &nbsp;
                    - in tf state           | &nbsp; |                       &nbsp;|                &nbsp;|                          &nbsp; 
 &nbsp;               -- not in tf config   | 3      | { state }                   |                &nbsp;| **{ state } -><br/>known after apply**
 &nbsp;&emsp;            >> new == state    | 3a     |                       &nbsp;| { state }            |                          &nbsp;
 &nbsp;&emsp;            >> new != state    | 3b     |                       &nbsp;| **{ state -> new }** |                          &nbsp;
 &nbsp;               -- in tf config       | &nbsp; |                       &nbsp;|                &nbsp;|                          &nbsp;
 &nbsp;&emsp;            > config == state  | 4a     | { state }                   |                &nbsp;| { state }
 &nbsp;&emsp;&emsp;        >> new == state  | 4a1    |                       &nbsp;| { state }            |                          &nbsp;
 &nbsp;&emsp;&emsp;        >> new != state  | 4a2    |                       &nbsp;| **{ state -> new }** |                          &nbsp;
 &nbsp;&emsp;            > config != state  | 4b     | { state -> config }         |                &nbsp;| { state -> config }      
 &nbsp;&emsp;&emsp;        >> new == config | 4b1    |                       &nbsp;| { state -> config }  |                          &nbsp;
 &nbsp;&emsp;&emsp;        >> new != config | 4b2    |                       &nbsp;| **{ state -> new }** |                          &nbsp;

<br/>

